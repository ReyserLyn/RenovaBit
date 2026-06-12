import { Elysia } from "elysia";
import { WebSocketPlugin } from "@/plugins/websocket";
import { adminRouter } from "./admin";
import { AuthModule } from "./auth";
import { brandsRoute } from "./brands";
import { cartRoute } from "./cart";
import { categoriesRoute } from "./categories";
import { homeRoute } from "./home";
import { ordersRoute } from "./orders";
import { productsRoute } from "./products";

const ApiV1Modules = new Elysia({ prefix: "/api/v1" })
	.use(AuthModule)
	.use(productsRoute)
	.use(categoriesRoute)
	.use(brandsRoute)
	.use(cartRoute)
	.use(ordersRoute)
	.use(adminRouter)
	.use(WebSocketPlugin);

const RootModules = new Elysia({ name: "routes" }).use(homeRoute);

export const modules = new Elysia().use(RootModules).use(ApiV1Modules);
