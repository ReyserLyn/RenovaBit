import { Elysia } from "elysia";
import { homeRoute } from "./home";

export const routes = new Elysia({ name: "routes" }).use(homeRoute);
