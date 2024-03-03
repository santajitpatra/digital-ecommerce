import express from "express";
import { getPayloadClient } from "./get-payload";
import { nextApp, nextHandler } from "./next-utils";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "./trpc";
import { inferAsyncReturnType } from "@trpc/server";
import { IncomingMessage } from "http";
import bodyParser from "body-parser";
import { stripeWebhookHandler } from "./webhooks";
import path from "path";
import nextBuild from "next/dist/build";
import { PayloadRequest } from "payload/types";
import { parse } from "url";


const app = express();
const PORT = Number(process.env.PORT) || 3000;

const createContext = ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => ({
  req,
  res,
});
export type ExpressContext = inferAsyncReturnType<typeof createContext>;

export type WebhookRequest = IncomingMessage & {
  rawBody: Buffer;
};

const start = async () => {
  const webhookMiddleware = bodyParser.json({
    verify: (req: WebhookRequest, _, buffer) => {
      req.rawBody = buffer;
    },
  });

  app.post("/api/webhooks/stripe", webhookMiddleware, stripeWebhookHandler);
  
  // Create a new CMS instance
  const payload = await getPayloadClient({
    initOptions: {
      express: app,
      onInit: async (cms) => {
        cms.logger.info(`Admin URL: ${cms.getAdminURL()}`);
      },
    },
  });

  // build the app for production
  if (process.env.NEXT_BUILD) {
    app.listen(PORT, async () => {
      payload.logger.info("Next.js is building for production");

      // @ts-expect-error
      await nextBuild(path.join(__dirname, "../"));

      process.exit();
    });

    return;
  }


  // Create a new express router for cart routes
   const cartRouter = express.Router();

   cartRouter.use(payload.authenticate);

   cartRouter.get("/", (req, res) => {
     const request = req as PayloadRequest;

     if (!request.user) return res.redirect("/sign-in?origin=cart");

     const parsedUrl = parse(req.url, true);
     const { query } = parsedUrl;

     return nextApp.render(req, res, "/cart", query);
   });

   app.use("/cart", cartRouter);


   // Create a new trpc instance
   app.use(
     "/api/trpc",
     trpcExpress.createExpressMiddleware({
       router: appRouter,
       createContext,
     })
   );

  app.use((req, res) => nextHandler(req, res));

  nextApp.prepare().then(() => {
    payload.logger.info("Next.js started");

    app.listen(PORT, async () => {
      payload.logger.info(
        `Next.js App URL: ${process.env.NEXT_PUBLIC_SERVER_URL}`
      );
    });
  });
};

start();
