# Instabug 14.1.0 issue with Network Logger and some http requests

This repo contains a minimal repro for an issue with the latest Instabug SDK for react-native.

Make sure to add a valid Instabug token on `config.ts`.

To allow visualizing the error easily in dev, since it is an unhandled promise rejection. I'm including a patch in the patches folder that add logs to react-native. After running `npm install` it should be applied automatically by `patch-package` but ideally check under node_modules to be sure.

If the network logger is enabled (it is by default), the error is trigger in the network check.

## Issue description and investigation

After trying out upgrade from Instabug 14.0.0 to 14.1.0 we started to see a bunch of
non-fatal errors on the "Crashes" section on our dashboard for the release build with the following message:

`Error - Request has not been opened`

The error is thrown from this react-native file: https://github.com/facebook/react-native/blob/110450105e140d0846c63d3d15f356beefaeb020/packages/react-native/Libraries/Network/XMLHttpRequest.js#L540. I verified by manually insertting logs there in my node_modules/eract-native.

Reverting back to 14.0.0 solves it. We stop getting those.

After some debugging I found that when Instabug's Network Logger is enabled, some http requests from the connectivity checks done with [@react-native-community/netinfo](https://github.com/react-native-netinfo/react-native-netinfo) (a pretty standard package to check for network status) start to throw that error. So disabling the Network Logger on 14.1.0 also solves it.

The first underlying request it does when you try like `NetInfo.fetch` will trigger that. And you can't catch it. You can simulate the first request by recalling `NetInfo.configure` to reset the initial.

I looked at the changes from 14.0 to 14.1 and found something that can cause issues.

This is the original `XMLHttpRequest` `send` method implementation from react-native:
https://github.com/facebook/react-native/blob/110450105e140d0846c63d3d15f356beefaeb020/packages/react-native/Libraries/Network/XMLHttpRequest.js#L538

Where `send` has this signature:

```tsx
send: (data: any): void
```

This is the override done by Instabug 14.0.0 on the XhrNetworkInterceptor when you have the Network Logger enabled:

https://github.com/Instabug/Instabug-React-Native/blob/6692f7b5d8ada49827427ad553ca7836d6a3bd85/src/utils/XhrNetworkInterceptor.ts#L94

Method is still

```tsx
send: (data: any): void
```

And this is it on Instabug 14.1.0:

https://github.com/Instabug/Instabug-React-Native/blob/2b094ca90f714cb8058be7a6b1c8a17975f943ae/src/utils/XhrNetworkInterceptor.ts#L178

Now this turns into

```tsx
send: async (data: any): Promise<void>
```

because it is doing:

```tsx
async function (data) {
  // ...
  const traceparent = await getTraceparentHeader(cloneNetwork); // <--- awaiting this
  if (traceparent) {
    this.setRequestHeader('Traceparent', traceparent);
  }
  //...
}

```

So something that is originally sync is now being overriden with an async operation
that can have some delay before resolving.

This can break stuff that was relying on the sync behavior.

So I tried manually doing this on 14.1.0:

```diff
diff --git a/node_modules/instabug-reactnative/src/utils/XhrNetworkInterceptor.ts b/node_modules/instabug-reactnative/src/utils/XhrNetworkInterceptor.ts
index 4443940..1862b36 100644
--- a/node_modules/instabug-reactnative/src/utils/XhrNetworkInterceptor.ts
+++ b/node_modules/instabug-reactnative/src/utils/XhrNetworkInterceptor.ts
@@ -175,7 +175,7 @@ export default {
       originalXHRSetRequestHeader.apply(this, [header, value]);
     };

-    XMLHttpRequest.prototype.send = async function (data) {
+    XMLHttpRequest.prototype.send = function (data) {
       const cloneNetwork = JSON.parse(JSON.stringify(network));
       cloneNetwork.requestBody = data ? data : '';

@@ -310,10 +310,10 @@ export default {
       }

       cloneNetwork.startTime = Date.now();
-      const traceparent = await getTraceparentHeader(cloneNetwork);
-      if (traceparent) {
-        this.setRequestHeader('Traceparent', traceparent);
-      }
+      // const traceparent = await getTraceparentHeader(cloneNetwork);
+      // if (traceparent) {
+      //   this.setRequestHeader('Traceparent', traceparent);
+      // }
       originalXHRSend.apply(this, [data]);
     };
     isInterceptorEnabled = true;
```

And it fixes the issue.
