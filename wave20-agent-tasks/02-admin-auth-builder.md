# Agent 2: Admin Auth Builder

## Role
Build admin authentication service with login, JWT token management with admin role, session tracking, and account lockout protection.

## Priority: WAVE 20 (After Agent 1)

## Wait Condition
Check for `.agent-done-W20-01` marker file before starting.

## Files to CREATE

### 1. `server/src/services/admin-auth.ts`
**Purpose**: Admin authentication, JWT management, and session security
**Pattern**: Service class with crypto and JWT handling

- [ ] Create `AdminAuthService` class:
  ```typescript
  interface AdminAuthConfig {
    jwtSecret: string;                // from env: ADMIN_JWT_SECRET (required)
    jwtExpiresIn: string;             // default: '8h'
    refreshTokenExpiresIn: string;    // default: '7d'
    bcryptRounds: number;             // default: 12
    maxFailedAttempts: number;        // default: 5
    lockoutDurationMs: number;        // default: 900000 (15 minutes)
    sessionTimeoutMs: number;         // default: 28800000 (8 hours)
  }
  ```

- [ ] **Password Hashing**:
  ```typescript
  async hashPassword(password: string): Promise<string>;
  async verifyPassword(password: string, hash: string): Promise<boolean>;
  ```
  - Use `bcrypt` (or `bcryptjs` for pure JS) with configurable rounds
  - Constant-time comparison to prevent timing attacks

- [ ] **Admin Login**: `async login(username: string, password: string, ipAddress?: string): Promise<LoginResult>`
  ```typescript
  interface LoginResult {
    success: boolean;
    token?: string;
    refreshToken?: string;
    admin?: {
      id: string;
      username: string;
      email: string;
      displayName: string;
      role: string;
      permissions: string[];
    };
    error?: string;
    remainingAttempts?: number;
  }
  ```
  - Query `admin_users` by username
  - Check `is_active` status
  - Check `locked_until` -- reject if still locked
  - Verify password against `password_hash`
  - On failure: increment `failed_login_count`, lock if >= `maxFailedAttempts`
  - On success: reset `failed_login_count`, update `last_login_at`, increment `login_count`
  - Generate JWT with payload: `{ adminId, username, role, permissions, iat, exp }`
  - Generate refresh token (separate longer-lived JWT)
  - Log login attempt to `user_activity_log`

- [ ] **JWT Token Management**:
  ```typescript
  generateToken(admin: AdminUser): string;
  generateRefreshToken(admin: AdminUser): string;
  verifyToken(token: string): AdminTokenPayload | null;
  refreshAccessToken(refreshToken: string): Promise<{ token: string } | null>;
  ```
  ```typescript
  interface AdminTokenPayload {
    adminId: string;
    username: string;
    role: string;
    permissions: string[];
    iat: number;
    exp: number;
  }
  ```
  - Use `jsonwebtoken` library (already in project dependencies)
  - Access token: 8 hours expiry
  - Refresh token: 7 days expiry with admin ID only
  - Verify checks expiry and signature validity

- [ ] **Admin Middleware**: `adminAuthMiddleware(requiredPermission?: string)`
  ```typescript
  function adminAuthMiddleware(requiredPermission?: string) {
    return async (c: Context, next: () => Promise<void>) => {
      const authHeader = c.req.header('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ error: 'Admin authentication required' }, 401);
      }

      const token = authHeader.slice(7);
      const payload = adminAuthService.verifyToken(token);

      if (!payload) {
        return c.json({ error: 'Invalid or expired admin token' }, 401);
      }

      if (requiredPermission && !payload.permissions.includes(requiredPermission)) {
        return c.json({ error: 'Insufficient admin permissions' }, 403);
      }

      c.set('admin', payload);
      await next();
    };
  }
  ```
  - Extract Bearer token from Authorization header
  - Verify JWT signature and expiry
  - Check required permission if specified
  - Set `admin` context variable for downstream handlers

- [ ] **Account Management**:
  ```typescript
  async createAdmin(data: CreateAdminInput): Promise<AdminUser>;
  async updateAdmin(id: string, data: UpdateAdminInput): Promise<AdminUser>;
  async deactivateAdmin(id: string): Promise<void>;
  async resetPassword(id: string, newPassword: string): Promise<void>;
  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<boolean>;
  async unlockAccount(id: string): Promise<void>;
  async listAdmins(): Promise<AdminUser[]>;
  ```

- [ ] **Session Tracking**:
  ```typescript
  private activeSessions: Map<string, { adminId: string; loginAt: number; lastActivity: number; ipAddress: string }>;

  async trackSession(adminId: string, ipAddress: string): string;  // returns sessionId
  async validateSession(sessionId: string): boolean;
  async endSession(sessionId: string): void;
  async getActiveSessions(): SessionInfo[];
  ```
  - In-memory session tracking (no Redis dependency)
  - Auto-expire sessions after `sessionTimeoutMs`
  - Log session events to `user_activity_log`

- [ ] **Initial Admin Setup**: `async seedDefaultAdmin(): Promise<void>`
  - On first run (no admin_users exist), create default admin:
    - username: `admin`
    - password: from env `ADMIN_DEFAULT_PASSWORD` or generate random
    - role: `super_admin`
    - permissions: all
  - Log generated password to console if auto-generated
  - Only runs once (check if any admin exists first)

- [ ] **Password Policy**:
  ```typescript
  validatePassword(password: string): { valid: boolean; errors: string[] };
  ```
  - Minimum 8 characters
  - At least 1 uppercase, 1 lowercase, 1 number
  - Not in common password list (top 100)

## Files to MODIFY

### 2. `server/src/index.ts`
- [ ] Import `AdminAuthService` and `adminAuthMiddleware`
- [ ] Instantiate service and call `seedDefaultAdmin()` on startup
- [ ] Add admin auth routes:
  ```typescript
  // Admin login
  app.post('/api/admin/auth/login', async (c) => {
    const { username, password } = await c.req.json();
    const result = await adminAuthService.login(username, password, c.req.header('x-forwarded-for'));
    if (!result.success) {
      return c.json({ error: result.error, remainingAttempts: result.remainingAttempts }, 401);
    }
    return c.json(result);
  });

  // Refresh token
  app.post('/api/admin/auth/refresh', async (c) => {
    const { refreshToken } = await c.req.json();
    const result = await adminAuthService.refreshAccessToken(refreshToken);
    if (!result) return c.json({ error: 'Invalid refresh token' }, 401);
    return c.json(result);
  });

  // Logout
  app.post('/api/admin/auth/logout', adminAuthMiddleware(), async (c) => {
    const admin = c.get('admin');
    await adminAuthService.endSession(admin.adminId);
    return c.json({ success: true });
  });

  // Get current admin profile
  app.get('/api/admin/auth/me', adminAuthMiddleware(), async (c) => {
    const admin = c.get('admin');
    return c.json(admin);
  });

  // Change password
  app.post('/api/admin/auth/change-password', adminAuthMiddleware(), async (c) => {
    const admin = c.get('admin');
    const { currentPassword, newPassword } = await c.req.json();
    const success = await adminAuthService.changePassword(admin.adminId, currentPassword, newPassword);
    return c.json({ success });
  });
  ```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Default admin seeded on first startup
- [ ] Login returns valid JWT with admin payload
- [ ] JWT verification rejects expired tokens
- [ ] JWT verification rejects tampered tokens
- [ ] Account locks after 5 failed login attempts
- [ ] Locked account rejects login with appropriate error
- [ ] Admin middleware rejects requests without token
- [ ] Admin middleware rejects requests with insufficient permissions
- [ ] Password change requires correct current password
- [ ] Refresh token generates new access token
- [ ] Create marker file: `.agent-done-W20-02`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W20-01`) for admin schema/tables
- **Reuses**: Hono context patterns, existing JWT patterns if any
- **New deps**: `bcryptjs` (or `bcrypt`), `jsonwebtoken` (likely already present)
