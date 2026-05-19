import { Elysia } from "elysia";
import { homeRoute } from "./home";

export const modules = new Elysia({ name: "routes" }).use(homeRoute);
