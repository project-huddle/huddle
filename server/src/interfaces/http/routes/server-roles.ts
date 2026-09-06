import { Elysia, t } from "elysia";
import { error, json } from "@/interfaces/http/responses";
import {
  assignRole,
  createRole,
  deleteRole,
  listPermissions,
  listRoles,
  updateRole,
} from "@/infra/database/server-repository";
import { authenticatedRoutes } from "../plugins/auth";
import { resourceId, serverIdParams } from "../schemas";

const roleParams = t.Object({ serverId: resourceId, roleId: resourceId });
const memberRoleParams = t.Object({ serverId: resourceId, memberId: resourceId, roleId: resourceId });
const roleBody = t.Object({
  name: t.String({ minLength: 2, maxLength: 40 }),
  color: t.Optional(t.String({ pattern: "^#[0-9a-fA-F]{6}$" })),
  permissions: t.Optional(t.Array(t.String({ maxLength: 80 }))),
});
const roleUpdateBody = t.Partial(roleBody);

export const serverRoleRoutes = new Elysia({ name: "server-role-routes" })
  .use(authenticatedRoutes("authenticated-server-role-routes"))
  .get("/permissions", async () => json({ permissions: await listPermissions() }))
  .get("/servers/:serverId/roles", async ({ currentUser, params }) => {
    const roles = await listRoles(currentUser.id, params.serverId);
    if (!roles) return error(403, "FORBIDDEN", "Você não pertence a este servidor.");
    return json({ roles });
  }, { params: serverIdParams })
  .post("/servers/:serverId/roles", async ({ currentUser, params, body }) => {
    const role = await createRole(currentUser.id, params.serverId, body.name.trim(), body.color ?? "#64748b", body.permissions ?? []);
    if (!role) return error(403, "FORBIDDEN", "Você não pode criar cargos neste servidor.");
    return json({ role }, 201);
  }, { params: serverIdParams, body: roleBody })
  .patch("/servers/:serverId/roles/:roleId", async ({ currentUser, params, body }) => {
    const role = await updateRole(currentUser.id, params.serverId, params.roleId, body);
    if (!role) return error(403, "FORBIDDEN", "Você não pode editar este cargo.");
    return json({ role });
  }, { params: roleParams, body: roleUpdateBody })
  .delete("/servers/:serverId/roles/:roleId", async ({ currentUser, params }) => {
    if (!(await deleteRole(currentUser.id, params.serverId, params.roleId))) return error(403, "FORBIDDEN", "Você não pode excluir este cargo.");
    return new Response(null, { status: 204 });
  }, { params: roleParams })
  .put("/servers/:serverId/members/:memberId/roles/:roleId", async ({ currentUser, params }) => {
    if (!(await assignRole(currentUser.id, params.serverId, params.memberId, params.roleId, true))) return error(403, "FORBIDDEN", "Você não pode atribuir este cargo.");
    return new Response(null, { status: 204 });
  }, { params: memberRoleParams })
  .delete("/servers/:serverId/members/:memberId/roles/:roleId", async ({ currentUser, params }) => {
    if (!(await assignRole(currentUser.id, params.serverId, params.memberId, params.roleId, false))) return error(403, "FORBIDDEN", "Você não pode remover este cargo.");
    return new Response(null, { status: 204 });
  }, { params: memberRoleParams });
