import { publicProcedure, router } from "./trpc";

export const appRouter = router({
  anyApiRoute: publicProcedure.query(() => {
    return "Hello from API";
  }),
});

export type AppRouter = typeof appRouter;
