# Build with the generated, checksum-verified bundle directory as context.
FROM node:24-trixie-slim@sha256:8ec5d7557396cfe32d21c3f9c13072355ceab22b584578ca4bb28af31120cffe
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/browsers
WORKDIR /opt/bulletin-renderer
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund \
    && npx playwright install --with-deps --only-shell chromium \
    && apt-get install -y --no-install-recommends \
       libpcre2-8-0=10.46-1~deb13u3 libssl3t64=3.5.7-1~deb13u3 openssl-provider-legacy=3.5.7-1~deb13u3 \
    && rm -rf /var/lib/apt/lists/* /root/.npm \
       /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-v1.22.22 \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY packages ./packages
COPY scripts ./scripts
COPY assets ./assets
COPY LICENSE ./LICENSE
RUN node scripts/verify-bulletin-renderer-v7.mjs
USER 65532:65532
ENTRYPOINT ["node", "/opt/bulletin-renderer/scripts/measure-bulletin-layout.mjs"]
