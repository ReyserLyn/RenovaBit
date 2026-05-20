import { Elysia } from "elysia";
import { AuthModule } from "./auth";
import { brandsRoute } from "./brands";
import { categoriesRoute } from "./categories";
import { homeRoute } from "./home";

const ApiV1Modules = new Elysia({ prefix: "/api/v1" })
	.use(AuthModule)
	.use(brandsRoute)
	.use(categoriesRoute);

const RootModules = new Elysia({ name: "routes" }).use(homeRoute);

export const modules = new Elysia().use(RootModules).use(ApiV1Modules);
