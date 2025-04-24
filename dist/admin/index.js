"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const adminAuthMiddleware_1 = require("./middleware/adminAuthMiddleware");
// Create an admin router
const router = express_1.default.Router();
// Apply admin authentication middleware to all admin routes
router.use(adminAuthMiddleware_1.authenticateAdmin);
// Mount admin routes
router.use('/', adminRoutes_1.default);
// Export the configured admin router
exports.default = router;
//# sourceMappingURL=index.js.map