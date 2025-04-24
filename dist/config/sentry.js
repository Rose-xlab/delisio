"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initWorkerSentry = exports.captureException = exports.addSentryErrorHandler = exports.initSentry = void 0;
const Sentry = __importStar(require("@sentry/node"));
const Tracing = __importStar(require("@sentry/tracing"));
const initSentry = (app) => {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        integrations: [
            new Sentry.Integrations.Http({ tracing: true }),
            new Tracing.Integrations.Express({ app }),
        ],
        tracesSampleRate: 0.5,
        environment: process.env.NODE_ENV,
        release: 'delisio@1.0.0', // Update with your version
    });
    // Add Sentry request handler and tracing
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
};
exports.initSentry = initSentry;
const addSentryErrorHandler = (app) => {
    // Add Sentry error handler before your own error handler
    app.use(Sentry.Handlers.errorHandler());
};
exports.addSentryErrorHandler = addSentryErrorHandler;
const captureException = (error, context) => {
    Sentry.withScope(scope => {
        if (context) {
            if (context.tags) {
                Object.entries(context.tags).forEach(([key, value]) => {
                    scope.setTag(key, String(value));
                });
            }
            if (context.user) {
                scope.setUser(context.user);
            }
            if (context.extra) {
                Object.entries(context.extra).forEach(([key, value]) => {
                    scope.setExtra(key, value);
                });
            }
        }
        Sentry.captureException(error);
    });
};
exports.captureException = captureException;
// For worker processes
const initWorkerSentry = (workerName) => {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV,
        release: 'delisio@1.0.0', // Use your version
        tracesSampleRate: 0.3,
        tags: {
            worker: workerName
        }
    });
    return Sentry;
};
exports.initWorkerSentry = initWorkerSentry;
//# sourceMappingURL=sentry.js.map