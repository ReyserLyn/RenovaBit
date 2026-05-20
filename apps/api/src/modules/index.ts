import { Elysia } from "elysia";
import { AuthModule } from "./auth";
import { brandsRoute } from "./brands";
import { categoriesRoute } from "./categories";
import { homeRoute } from "./home";
import { productImagesRoute } from "./product-images";
import { productsRoute } from "./products";
import { storageRoute } from "./storage";

const ApiV1Modules = new Elysia({ prefix: "/api/v1" })
	.use(AuthModule)
	.use(brandsRoute)
	.use(categoriesRoute)
	.use(productsRoute)
	.use(productImagesRoute)
	.use(storageRoute);

const RootModules = new Elysia({ name: "routes" }).use(homeRoute);

export const modules = new Elysia().use(RootModules).use(ApiV1Modules);
