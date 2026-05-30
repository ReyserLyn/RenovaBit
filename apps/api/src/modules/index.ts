import { Elysia } from "elysia";
import { WebSocketPlugin } from "@/plugins/websocket";
import { AuthModule } from "./auth";
import { brandsRoute } from "./brands";
import { categoriesRoute } from "./categories";
import { homeRoute } from "./home";
import { notificationsRoute } from "./notifications";
import { productImagesRoute } from "./product-images";
import { productsRoute } from "./products";
import { scrapingController } from "./scrapping";
import { storageRoute } from "./storage";
import { usersRoute } from "./users";

const ApiV1Modules = new Elysia({ prefix: "/api/v1" })
	.use(AuthModule)
	.use(brandsRoute)
	.use(categoriesRoute)
	.use(productsRoute)
	.use(productImagesRoute)
	.use(notificationsRoute)
	.use(storageRoute)
	.use(usersRoute)
	.use(scrapingController)
	.use(WebSocketPlugin);

const RootModules = new Elysia({ name: "routes" }).use(homeRoute);

export const modules = new Elysia().use(RootModules).use(ApiV1Modules);
