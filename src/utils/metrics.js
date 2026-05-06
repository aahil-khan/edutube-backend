import os from 'os';
import client from 'prom-client';

const register = new client.Registry();
const appName = process.env.APP_NAME || 'edutube-backend';
const instanceId = process.env.INSTANCE_ID || process.env.HOSTNAME || os.hostname();

register.setDefaultLabels({
  app: appName,
  instance: instanceId,
  env: process.env.NODE_ENV || 'development',
});

client.collectDefaultMetrics({ register });

const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [register],
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpInFlightRequests = new client.Gauge({
  name: 'http_in_flight_requests',
  help: 'Current number of in-flight HTTP requests',
  registers: [register],
});

function resolveRoute(req) {
  if (req.route?.path) {
    return req.baseUrl ? `${req.baseUrl}${req.route.path}` : req.route.path;
  }
  return req.path || 'unknown';
}

export function metricsMiddleware(req, res, next) {
  if (req.path === '/metrics') {
    return next();
  }

  const startHrTime = process.hrtime.bigint();
  httpInFlightRequests.inc();

  res.on('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - startHrTime) / 1e9;
    const route = resolveRoute(req);
    const statusCode = String(res.statusCode);

    httpRequestDurationSeconds.observe(
      { method: req.method, route, status_code: statusCode },
      durationSeconds
    );
    httpRequestTotal.inc({ method: req.method, route, status_code: statusCode });
    httpInFlightRequests.dec();
  });

  next();
}

export async function metricsHandler(_req, res) {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}
