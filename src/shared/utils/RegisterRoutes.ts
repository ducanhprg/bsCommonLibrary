import { Router } from 'express';

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';

type RouteConfig = {
    path: string;
    method?: HttpMethod;
    middleware?: any[];
    handler: any;
};

export const RegisterRoutes = (router: Router, routes: RouteConfig[]) => {
    routes.forEach(({ path, method = 'get', middleware = [], handler }) => {
        router[method](path, ...middleware, handler);
    });
};
