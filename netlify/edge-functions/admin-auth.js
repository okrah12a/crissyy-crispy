// Protects every /admin* route with HTTP Basic Auth.
// Set ADMIN_USER and ADMIN_PASS as environment variables in the Netlify
// dashboard (Site settings -> Environment variables) — do not hardcode
// them here.

export default async (request, context) => {
  const authHeader = request.headers.get("authorization");
  const expectedUser = Deno.env.get("ADMIN_USER");
  const expectedPass = Deno.env.get("ADMIN_PASS");

  if (!expectedUser || !expectedPass) {
    return new Response(
      "Admin auth is not configured. Set ADMIN_USER and ADMIN_PASS in Netlify environment variables.",
      { status: 500 }
    );
  }

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded);
      const separatorIndex = decoded.indexOf(":");
      const user = decoded.slice(0, separatorIndex);
      const pass = decoded.slice(separatorIndex + 1);

      if (user === expectedUser && pass === expectedPass) {
        return context.next();
      }
    }
  }

  return new Response("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Crissyy Crispy Admin"',
    },
  });
};

export const config = {
  path: "/admin*",
};
