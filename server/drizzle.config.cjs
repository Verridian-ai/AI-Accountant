/** @type { import("drizzle-kit").Config } */
module.exports = {
    schema: "./src/schema.ts",
    out: "./drizzle",
    driver: "turso",
    dbCredentials: {
        url: "file:sqlite.db",
    },
};
