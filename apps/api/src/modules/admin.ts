import { Elysia } from "elysia";
import { adminBrandsRoute } from "./brands/admin";
import { adminCategoriesRoute } from "./categories/admin";
import { changesRoute } from "./changes";
import { notificationsRoute } from "./notifications";
import { adminOrdersRoute } from "./orders/admin";
import { productImagesRoute } from "./product-images";
import { adminProductsRoute } from "./products/admin";
import { reportsRoute } from "./reports";
import { scrapingController } from "./scrapping";
import { storageRoute } from "./storage";
import { usersRoute } from "./users";

export const adminRouter = new Elysia({ prefix: "/admin" })
	.use(adminProductsRoute)
	.use(adminCategoriesRoute)
	.use(adminBrandsRoute)
	.use(usersRoute)
	.use(storageRoute)
	.use(scrapingController)
	.use(notificationsRoute)
	.use(changesRoute)
	.use(reportsRoute)
	.use(productImagesRoute)
	.use(adminOrdersRoute);
