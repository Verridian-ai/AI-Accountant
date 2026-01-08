/** @type { import("drizzle-kit").Config } */
module.exports = {
    schema: "./src/db.ts",
    out: "./drizzle",
    driver: "turso",
    dbCredentials: {
        url: "file:sqlite.db",
    },
};
