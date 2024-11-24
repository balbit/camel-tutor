interface RunCodeResponse {
    output: string;
}

export function submitCode(code: string): Promise<RunCodeResponse> {
    const sessionId = localStorage.getItem("sessionId") || crypto.randomUUID();
    localStorage.setItem("sessionId", sessionId);

    const response = fetch("https://camel.elliotliu.com/run-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, sessionId })
    });

    return response.then(res => res.json());
}
