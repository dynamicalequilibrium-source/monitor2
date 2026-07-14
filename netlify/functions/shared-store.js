const BINS = {
    users: "https://extendsclass.com/api/json-storage/bin/ccffaad",
    requests: "https://extendsclass.com/api/json-storage/bin/dddacfc"
};

exports.handler = async (event, context) => {
    const type = event.queryStringParameters.type;
    const binUrl = BINS[type];

    if (!binUrl) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Invalid type parameter" })
        };
    }

    const method = event.httpMethod;

    try {
        if (method === "GET") {
            const res = await fetch(binUrl);
            if (!res.ok) throw new Error(`ExtendsClass GET status: ${res.status}`);
            const data = await res.json();
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            };
        } else if (method === "PUT" || method === "POST") {
            const res = await fetch(binUrl, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: event.body
            });
            if (!res.ok) throw new Error(`ExtendsClass PUT status: ${res.status}`);
            const data = await res.json();
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            };
        } else {
            return {
                statusCode: 405,
                body: JSON.stringify({ error: "Method Not Allowed" })
            };
        }
    } catch (err) {
        console.error("Proxy error:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};
