export function createNotImplementedHandler(domain: string) {
  return function notImplementedHandler() {
    return Response.json(
      { error: `O endpoint ${domain} ainda não foi implementado.` },
      { status: 501 },
    );
  };
}
