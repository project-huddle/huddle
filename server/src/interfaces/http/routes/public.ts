import { Elysia } from "elysia";
import { json } from "@/interfaces/http/responses";
export const publicRoutes = new Elysia({name: "public-routes"}).get("/health", () => json({status:"ok",timestamp:new Date().toISOString()}));
