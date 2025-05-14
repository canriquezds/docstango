
## Developer's Log

**Project:** Docstango



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