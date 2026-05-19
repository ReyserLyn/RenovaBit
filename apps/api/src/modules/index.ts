import { Elysia } from "elysia";
import { AuthModule } from "./auth";
import { brandsRoute } from "./brands";
import { homeRoute } from "./home";

// AuthModule debe registrarse ANTES que las rutas que usan sus macros.
const ApiV1Modules = new Elysia({ prefix: "/api/v1" }).use(AuthModule).use(brandsRoute);

const RootModules = new Elysia({ name: "routes" }).use(homeRoute);

export const modules = new Elysia().use(RootModules).use(ApiV1Modules);
