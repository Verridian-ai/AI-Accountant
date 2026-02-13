import { useEffect, useRef, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getNavSections } from '@/routes';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NavigationDrawer({ isOpen, onClose }: NavigationDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const sections = getNavSections();

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      startYRef.current = touch.clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      currentYRef.current = touch.clientY;
      const delta = currentYRef.current - startYRef.current;
      if (delta > 0 && drawerRef.current) {
        drawerRef.current.style.transform = `translateY(${delta}px)`;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const delta = currentYRef.current - startYRef.current;
    if (delta > 100) {
      onClose();
    }
    if (drawerRef.current) {
      drawerRef.current.style.transform = '';
    }
    startYRef.current = 0;
    currentYRef.current = 0;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto neu-raised rounded-t-3xl animate-in slide-in-from-bottom duration-200"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle bar */}
        <div className="sticky top-0 z-10 glass rounded-t-3xl">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-zinc-600" />
          </div>
          <div className="px-4 pb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gradient-gold">Navigation</h2>
            <button
              type="button"
              onClick={onClose}
              className="neu-raised-sm p-2 rounded-xl text-zinc-400 hover:text-white"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Sections */}
        <div className="px-4 pb-8 space-y-4">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 px-2">
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.navId}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200',
                        isActive
                          ? 'bg-[#FFCC00]/10 border border-[#FFCC00]/20 text-[#FFCC00]'
                          : 'text-zinc-300 hover:bg-white/5 border border-transparent',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div
                          className={cn(
                            'p-2 rounded-lg',
                            isActive ? 'bg-[#FFCC00]/15' : 'neu-inset',
                          )}
                        >
                          <item.icon className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                          <div className="font-semibold text-sm">{item.label}</div>
                        </div>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
