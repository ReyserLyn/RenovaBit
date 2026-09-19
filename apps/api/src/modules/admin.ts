import { Elysia } from "elysia";
import { adminBrandsRoute } from "./brands/admin";
import { adminCategoriesRoute } from "./categories/admin";
import { changesRoute } from "./changes";
import { adminComplaintsRoute } from "./complaints/admin";
import { adminMarginRulesRoute } from "./margin-rules/admin";
import { notificationsRoute } from "./notifications";
import { adminOffersRoute } from "./offers/admin";
import { adminOrdersRoute } from "./orders/admin";
import { productImagesRoute } from "./product-images";
import { adminProductsRoute } from "./products/admin";
import { reportsRoute } from "./reports";
import { scrapingController } from "./scrapping";
import { storageRoute } from "./storage";
import { adminUsersRoute } from "./users/admin";

export const adminRouter = new Elysia({ prefix: "/admin" })
	.use(adminOffersRoute)
	.use(adminMarginRulesRoute)
	.use(adminProductsRoute)
	.use(adminCategoriesRoute)
	.use(adminBrandsRoute)
	.use(adminUsersRoute)
	.use(storageRoute)
	.use(scrapingController)
	.use(notificationsRoute)
	.use(changesRoute)
	.use(reportsRoute)
	.use(productImagesRoute)
	.use(adminOrdersRoute)
	.use(adminComplaintsRoute);
