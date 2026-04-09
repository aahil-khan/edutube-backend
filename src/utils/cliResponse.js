/**
 * Standard JSON envelopes for /api/cli/* (snake_case inside data payloads).
 */

export function cliSuccess(res, data, options = {}) {
    const { status = 200, created } = options;
    const body = { data };
    if (created !== undefined) {
        body.created = created;
    }
    return res.status(status).json(body);
}

export function cliError(res, status, code, message, details = {}) {
    return res.status(status).json({
        error: {
            code,
            message,
            details: details && Object.keys(details).length ? details : undefined
        }
    });
}
