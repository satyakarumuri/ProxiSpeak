
const API_URL = "http://localhost:3000/api/auth";

export async function registerUser(name, email, password) {
  return sendRequest("/register", { name, email, password });
}

export async function loginUser(email, password) {
  return sendRequest("/login", { email, password });
}

async function sendRequest(endpoint, data) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Something went wrong");
  }

  return result;
}
