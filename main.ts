import { Application, Router } from "https://deno.land/x/oak/mod.ts";

const router = new Router();
let recentUpdate: Deno.FsEvent = {} as Deno.FsEvent;

watchPostsDir();

router.get("/", async (context) => {
  const indexPage = await Deno.readTextFile("./client/index.html");
  context.response.headers.set("Context-Type", "text/html");
  context.response.body = indexPage;
});

router.post("/message", async (context) => {
  const payload = await context.request.body().value;
  const msg = payload.get("message");
  console.log("message: ", msg);
  context.response.body = `<li>${msg}</li>`;
});

router.get("/ws/message", (context) => {
  if (!context.isUpgradable) {
    context.throw(501);
  }

  const ws = context.upgrade();

  ws.addEventListener("open", () => {
    console.log("a client connected!");
  });

  ws.addEventListener("message", (event) => {
    const eventDataJson = JSON.parse(event.data);
    const message = eventDataJson["ws-message"];
    console.log("the message is: ", message);

    ws.send(
      `<ul id="ws-messages" hx-swap-oob="beforeend"><li>${message}</li></ul>`
    );
  });
});

router.get("/sse", (context) => {
  const target = context.sendEvents();
  let localFileUpdateState = recentUpdate;

  setInterval(() => {
    if (localFileUpdateState !== recentUpdate) {
      target.dispatchMessage({ recentEvent: recentUpdate });
      localFileUpdateState = recentUpdate;
    }
  }, 5000);
});

async function watchPostsDir() {
  const postsDir = Deno.watchFs("./posts");

  for await (const postsDirEvent of postsDir) {
    console.log("a file changed", postsDirEvent);
    recentUpdate = postsDirEvent;
  }
}

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());
await app.listen({ port: 8000 });
