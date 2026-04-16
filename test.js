fetch("http://localhost:3000/chat", {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        message: "¿Qué bachilleratos hay?"
    })
})
.then(r => r.json())
.then(console.log);