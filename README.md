
## Developer's Log

**Project:** Docstango


## May 21, 2025
Today we discovered that the `GitHubMCPServer` communicates using a `stdio` transport. This was confirmed after reading the post [How to host your MCP Server](https://www.devshorts.in/p/how-to-host-your-mcp-server), which helped clarify the server's expected setup.

![Standard Input/Output (stdio)](https://substackcdn.com/image/fetch/f_auto,q_auto\:good,fl_progressive\:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Ff3ac325c-f9f8-4e74-bf39-262178a3f96d_935x340.gif)

However, our goal is to connect to the MCP server **from a React app using HTTP**, so we began evaluating **Server-Sent Events (SSE)** as an alternative transport method.

> SSE works well when the server and client are on different machines or communicating across a network:
>
> * client → server: HTTP POST
> * server → client: SSE stream

![SSE](https://substackcdn.com/image/fetch/f_auto,q_auto\:good,fl_progressive\:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fba8c4ae3-d5cd-43db-9950-bca6d744a8bb_816x442.gif)

We also explored the OpenAI documentation—specifically the section on [Extend the model with tools](https://platform.openai.com/docs/quickstart#extend-the-model-with-tools) /Using tools/[Available tools](https://platform.openai.com/docs/guides/tools#available-tools)/ [Remote MCP](https://platform.openai.com/docs/guides/tools-remote-mcp) to understand how to declare a remote MCP server. There we found an example using `curl` that pointed to a remote `server_url`, which gave us a clearer picture of what we might configure:

```bash
curl https://api.openai.com/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
  "model": "gpt-4.1",
  "tools": [
    {
      "type": "mcp",
      "server_label": "deepwiki",
      "server_url": "https://mcp.deepwiki.com/mcp",
      "require_approval": "never"
    }
  ],
  "input": "What transport protocols does the 2025-03-26 version of the MCP spec (modelcontextprotocol/modelcontextprotocol) support?"
}'
```

This confirmed that our frontend could, in theory, communicate with an MCP server hosted via HTTP/SSE.

### 🔧 We're currently exploring two directions:

1. **Find and configure a public and ready basic MCP server**

   This would let us test end-to-end how our existing app and LLM client can consume an external MCP fast.

2. **Evaluate existing projects with SSE support to use with our app**

   We're considering [`express-mcp-sse-server`](https://github.com/yunusemredilber/express-mcp-sse-server) as a potential foundation to build our own remote GitHubMCP integration with SSE transport. It looks promising, so the idea is to explore this one on our next session

### Useful references:

* [How to host your MCP Server](https://www.devshorts.in/p/how-to-host-your-mcp-server)
* [MCP Server and Client with SSE & The New Streamable HTTP!](https://levelup.gitconnected.com/mcp-server-and-client-with-sse-the-new-streamable-http-d860850d9d9d)
* [Example MCP SSE Server](https://github.com/yunusemredilber/express-mcp-sse-server)

So, from this point forward, we’ve decided to move forward with the **SSE-based transport** approach.

---

Let me know if you'd like me to generate a downloadable `.md` file or integrate this into an existing changelog or PR summary.


## May 14, 2025
**Goal for the day:** Get the `github-mcp-server` running in a Docker container and perform some basic interaction tests.

Sources of the day:
Interesting blogpost to clarify key concepts: [Unwrapping MCP : A Walkthrough with the GitHub MCP Server](https://sagarag.medium.com/unwrapping-mcp-a-walkthrough-with-the-github-mcp-server-293608deaec8)
Github oficial repository: [https://github.com/github/github-mcp-server](https://github.com/github/github-mcp-server)


-----
**0. We cloned the github repository inside the `/src/GithubMcp`

**1. Understanding the Build Process:**

Started by examining the `Dockerfile` provided in the repository. It's a multi-stage build:

  * Stage 1 (`AS build`): Uses `golang:1.24.3-alpine` to compile the Go application (`cmd/github-mcp-server/main.go`). It cleverly installs Git to embed commit and date info into the binary and uses Docker BuildKit cache mounts for `apk` and Go modules/build cache to speed things up. The source code is bind-mounted for the build.
  * Stage 2 (Final image): Uses `gcr.io/distroless/base-debian12` for a minimal runtime environment, copying only the compiled binary from the build stage. The `CMD` is set to `["./github-mcp-server", "stdio"]`.

**2. Building the Docker Image:**

Proceeded to build the image. From the repository root:

```bash
docker build -t github-mcp-server-app .
```

The build completed successfully. Tagged it as `github-mcp-server-app`.
*Learning:* The multi-stage build is efficient, creating a lean final image. The build flags (`-ldflags`) are correctly embedding version information.

**3. First Attempt to Run the Container:**

Tried to run the freshly built image:

```bash
docker run --rm -it github-mcp-server-app
```

This immediately failed. The server outputted:

```
Error: GITHUB_PERSONAL_ACCESS_TOKEN not set
Usage:
  server stdio [flags]
# ... (plus other helpful global flags)
```

*Learning:* Okay, that's clear – the server requires a `GITHUB_PERSONAL_ACCESS_TOKEN` environment variable to start. The help output is a good reference for available flags too.

**4. Generating and Using the GitHub Token:**

Before the next run, I ensured I had a GitHub Personal Access Token. (For anyone else: go to GitHub Developer Settings \> Personal access tokens, generate one with appropriate scopes like `repo`).

Then, ran the container again, this time providing the token via the `-e` flag:

```bash
docker run --rm -it \
  -e GITHUB_PERSONAL_ACCESS_TOKEN="<personal access tocken>" \
  # ^^^ (Note: Used a placeholder/example token here for the log)
  github-mcp-server-app
```

Success\! The server started, and I saw:

```
GitHub MCP Server running on stdio
```

*Learning:* The `-e` flag is the standard way to pass environment variables to Docker containers, and it's crucial for configuring this server.

**5. Initial Interaction Attempt (and another learning moment\!):**

With the server running and listening on `stdio`, I tried a simple command to see if it would list something, like a directory:

```
ls
```

The server responded, but not with a file listing. Instead, I got a JSON error:

```json
{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error"}}
```

*Learning:* This "Parse error" (JSON-RPC error code -32700) clearly indicates the server isn't expecting plain text commands like `ls`. It's speaking JSON-RPC 2.0. My input needs to be a valid JSON-RPC request object.

**End of Day Summary & Next Steps:**

  * Successfully built the Docker image for `github-mcp-server`.
  * Confirmed the server runs correctly within Docker when provided with a `GITHUB_PERSONAL_ACCESS_TOKEN`.
  * Discovered that the server uses JSON-RPC 2.0 for communication over `stdio`.
  * **Next step:** Need to dive into the `github-mcp-server` documentation (or source code if docs are sparse) to understand its specific JSON-RPC methods, expected parameters, and the overall API structure. Only then can we send meaningful commands and properly test its functionality.

  * One hint is to build the request using this inside our current components:

```
    import axios from 'axios';
    
    const queryGitHubMCP = async (prompt) => {
      try {
        const response = await axios.post('http://localhost:8080/mcp', {
          "version": "0.1",
          "tool_name": "ask_chatgpt",
          "input": {
            "prompt": prompt,
            "model": "gpt-3.5-turbo",
            "temperature": 0.7,
            "max_output_tokens": 2000,
            "response_id": "123"
          }
        });
        return response.data.output.response;
      } catch (error) {
        console.error("Error querying GitHub MCP:", error);
        throw error;
      }
    };
```

-----