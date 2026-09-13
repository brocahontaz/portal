#!/bin/sh
# Portal runtime entrypoint (runs as uid 101 in the nginx-unprivileged image).
#
# Decision paths (one log line each, all to stderr):
# - PORTAL_SERVICES_PATH unset/empty      -> serve the baked-in default site.
# - set but path missing                  -> NOTICE + baked-in default site
#                                            (matches loadServices() fallback).
# - set but not a regular file (e.g. a
#   directory)                            -> ERROR + exit non-zero WITHOUT
#                                            starting nginx (matches
#                                            loadServices(), where
#                                            readFileSync on a directory
#                                            throws EISDIR — fail-fast).
# - set and regular file                  -> re-run `astro build` with the path
#                                            exported so loadServices() reads
#                                            it; on success replace the served
#                                            site with the fresh dist/.
# - any build failure                     -> exit non-zero WITHOUT starting
#                                            nginx (fail-fast: a bad override
#                                            config must never be silently
#                                            ignored).
#
# nginx is started via `exec "$@"`, so the image CMD (`nginx -g daemon off;`)
# stays overridable and nginx runs as PID 1's successor.
set -eu

PORTAL_DIR=/opt/portal
HTML_DIR=/usr/share/nginx/html

note() {
  printf '%s\n' "entrypoint: $*" >&2
}

case "${PORTAL_SERVICES_PATH:-}" in
"")
  note "PORTAL_SERVICES_PATH not set; serving the baked-in default services"
  ;;
*)
  if [ ! -e "$PORTAL_SERVICES_PATH" ]; then
    note "NOTICE: PORTAL_SERVICES_PATH is set to $PORTAL_SERVICES_PATH but the file does not exist; serving the baked-in default services"
  elif [ ! -f "$PORTAL_SERVICES_PATH" ]; then
    note "ERROR: PORTAL_SERVICES_PATH exists but is not a regular file: $PORTAL_SERVICES_PATH"
    exit 1
  else
    note "building site with services config $PORTAL_SERVICES_PATH"
    export PORTAL_SERVICES_PATH
    cd "$PORTAL_DIR"
    if ! npm run build; then
      note "build FAILED with services config $PORTAL_SERVICES_PATH; refusing to start nginx"
      exit 1
    fi
    rm -rf "${HTML_DIR:?}"/*
    cp -a "$PORTAL_DIR/dist/." "$HTML_DIR/"
  fi
  ;;
esac

exec "$@"
