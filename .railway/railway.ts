// Review-only IaC candidate based on live Railway inventory, not yet verified by Railway CLI pull/plan.
// No automatic apply. Keep Cloudflare release governance independent of this Railway configuration.
import { defineRailway, github, preserve, project, service } from "railway/iac";

export default defineRailway((ctx) => {
  if (ctx.projectId !== "45b0d932-d46f-495c-9a32-c4c76bfa92f1" || ctx.environmentId !== "34e49116-9464-4e85-bdf7-fa417c20f6b7") {
    throw new Error("Wrong Railway project/environment: refusing IaC evaluation");
  }
  const app = service("jussray", {
    source: github("jussray/THINK-TANK", { branch: "main" }),
    build: 'test -n "$RAILWAY_GIT_COMMIT_SHA" && THINK_TANK_SOURCE_SHA="$RAILWAY_GIT_COMMIT_SHA" THINK_TANK_EXPECTED_SHA="$RAILWAY_GIT_COMMIT_SHA" npm run build',
    start: "npx http-server _site -p ${PORT:-3000} -a 0.0.0.0 -c-1",
    healthcheck: "/",
    // Replica placement is deferred until the provider import confirms the service-region key.
    env: {
      THINK_TANK_EXPECTED_SHA: preserve(),
      THINK_TANK_RUNTIME_ENV: preserve(),
      THINK_TANK_SOURCE_SHA: preserve(),
    },
  });
  return project("Think Tank", { resources: [app] });
});
