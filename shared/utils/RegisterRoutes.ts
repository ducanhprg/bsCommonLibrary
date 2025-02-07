import { Router } from 'express';

type RouteConfig = {
    path: string;
    middleware?: any[];
    handler: any;
};

export const RegisterRoutes = (router: Router, routes: RouteConfig[]) => {
    routes.forEach(({ path, middleware = [], handler }) => {
        router.use(path, ...middleware, handler);
    });
};
