# Build with the generated, checksum-verified bundle directory as context.
FROM node:24-trixie-slim@sha256:8ec5d7557396cfe32d21c3f9c13072355ceab22b584578ca4bb28af31120cffe
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/browsers
WORKDIR /opt/bulletin-renderer
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund \
    && npx playwright install --with-deps --only-shell chromium \
    && rm -rf /var/lib/apt/lists/* /root/.npm
COPY packages ./packages
COPY scripts ./scripts
COPY assets ./assets
COPY LICENSE ./LICENSE
RUN node scripts/verify-bulletin-renderer.mjs
USER 65532:65532
ENTRYPOINT ["node", "/opt/bulletin-renderer/scripts/measure-bulletin-layout.mjs"]
