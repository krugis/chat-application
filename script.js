document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.querySelector("#chat-input");
    const sendButton = document.querySelector("#send-btn");
    const chatContainer = document.querySelector(".chat-container");
    const themeButton = document.querySelector("#theme-btn");
    const deleteButton = document.querySelector("#delete-btn");
    const toolButton = document.querySelector("#tool-btn");
    const settingsPanel = document.querySelector('.settings-panel');
    const closeSettings = document.querySelector('#close-settings');
    const modelSelect = document.querySelector('#model-select');
    const tempSlider = document.querySelector('#temp-slider');
    const toppSlider = document.querySelector('#topp-slider');
    const tempValue = document.querySelector('#temp-value');
    const toppValue = document.querySelector('#topp-value');

    let userText = null;
    const initialInputHeight = chatInput.scrollHeight;

    const loadDataFromLocalstorage = () => {
        // Load theme and chats
        const themeColor = localStorage.getItem("themeColor");
        document.body.classList.toggle("light-mode", themeColor === "light_mode");
        themeButton.innerText = document.body.classList.contains("light-mode") ? "dark_mode" : "light_mode";

        const defaultText = `<div class="default-text">
                                <h1>Multi-Model ChatBot</h1>
                                <p>Start a conversation and explore the power of AI.<br> Your messages will be saved until cache is cleared</p>
                            </div>`;
        chatContainer.innerHTML = localStorage.getItem("all-chats") || defaultText;
        chatContainer.scrollTo(0, chatContainer.scrollHeight);
    };

    const loadSettings = () => {
        // Load model settings
        modelSelect.value = localStorage.getItem('currentModel') || 'gemini-1.5-flash';
        tempSlider.value = localStorage.getItem('currentTemperature') || 0.1;
        toppSlider.value = localStorage.getItem('currentTopP') || 0.1;
        tempValue.textContent = tempSlider.value;
        toppValue.textContent = toppSlider.value;
    };

    const saveSettings = () => {
        localStorage.setItem('currentModel', modelSelect.value);
        localStorage.setItem('currentTemperature', tempSlider.value);
        localStorage.setItem('currentTopP', toppSlider.value);
    };

    const createChatElement = (content, className) => {
        const chatDiv = document.createElement("div");
        chatDiv.classList.add("chat", className);
        chatDiv.innerHTML = content;
        return chatDiv;
    };

    const getChatResponse = async (incomingChatDiv) => {
        const API_URL = "https://api.aigora.cloud/api/generate";
        const pElement = document.createElement("p");

        const requestOptions = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message: userText,
                model: modelSelect.value,
                temperature: parseFloat(tempSlider.value),
                top_p: parseFloat(toppSlider.value)
            }),
        };

        try {
            const fetchResponse = await fetch(API_URL, requestOptions);
            if (!fetchResponse.ok) throw new Error(`HTTP error! status: ${fetchResponse.status}`);
            
            const response = await fetchResponse.json();
            let contentText = '';

            // Updated frontend response handling
            if (response.status === 'success') {
            // For all models, use the unified response structure
                contentText = response.data.message.trim(); 
            } else {
            // Handle errors from backend
                contentText = response.message || "No response content found";
            }

            pElement.textContent = contentText;
        } catch (error) {
            console.error("Error:", error);
            pElement.classList.add("error");
            pElement.textContent = "Error: " + (error.message || "Failed to get response");
        }

        incomingChatDiv.querySelector(".typing-animation").remove();
        incomingChatDiv.querySelector(".chat-details").appendChild(pElement);
        localStorage.setItem("all-chats", chatContainer.innerHTML);
        chatContainer.scrollTo(0, chatContainer.scrollHeight);
    };

    const copyResponse = (copyBtn) => {
        const reponseTextElement = copyBtn.parentElement.querySelector("p");
        navigator.clipboard.writeText(reponseTextElement.textContent);
        copyBtn.textContent = "done";
        setTimeout(() => copyBtn.textContent = "content_copy", 1000);
    };

    const showTypingAnimation = () => {
        const html = `<div class="chat-content">
                        <div class="chat-details">
                            <img src="images/chatbot.png" alt="chatbot-img">
                            <div class="typing-animation">
                                <div class="typing-dot" style="--delay: 0.2s"></div>
                                <div class="typing-dot" style="--delay: 0.3s"></div>
                                <div class="typing-dot" style="--delay: 0.4s"></div>
                            </div>
                        </div>
                        <span onclick="copyResponse(this)" class="material-symbols-rounded">content_copy</span>
                    </div>`;
        const incomingChatDiv = createChatElement(html, "incoming");
        chatContainer.appendChild(incomingChatDiv);
        chatContainer.scrollTo(0, chatContainer.scrollHeight);
        getChatResponse(incomingChatDiv);
    };

    const handleOutgoingChat = () => {
        userText = chatInput.value.trim();
        if (!userText) return;

        chatInput.value = "";
        chatInput.style.height = `${initialInputHeight}px`;

        const html = `<div class="chat-content">
                        <div class="chat-details">
                            <img src="images/user.png" alt="user-img">
                            <p>${userText}</p>
                        </div>
                    </div>`;

        const outgoingChatDiv = createChatElement(html, "outgoing");
        chatContainer.querySelector(".default-text")?.remove();
        chatContainer.appendChild(outgoingChatDiv);
        chatContainer.scrollTo(0, chatContainer.scrollHeight);
        setTimeout(showTypingAnimation, 500);
    };

    // Event Listeners
    deleteButton.addEventListener("click", () => {
        if (confirm("Are you sure you want to delete all chats?")) {
            localStorage.removeItem("all-chats");
            loadDataFromLocalstorage();
        }
    });

    themeButton.addEventListener("click", () => {
        document.body.classList.toggle("light-mode");
        localStorage.setItem("themeColor", themeButton.innerText);
        themeButton.innerText = document.body.classList.contains("light-mode") ? "dark_mode" : "light_mode";
    });

    chatInput.addEventListener("input", () => {
        chatInput.style.height = `${initialInputHeight}px`;
        chatInput.style.height = `${chatInput.scrollHeight}px`;
    });

    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 800) {
            e.preventDefault();
            handleOutgoingChat();
        }
    });

    // Settings Panel Functionality
    toolButton.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPanel.classList.toggle('active');
    });

    closeSettings.addEventListener('click', () => {
        settingsPanel.classList.remove('active');
    });

    document.addEventListener('click', (e) => {
        if (!settingsPanel.contains(e.target) && e.target !== toolButton) {
            settingsPanel.classList.remove('active');
        }
    });

    modelSelect.addEventListener('change', saveSettings);
    tempSlider.addEventListener('input', (e) => {
        tempValue.textContent = e.target.value;
        saveSettings();
    });
    toppSlider.addEventListener('input', (e) => {
        toppValue.textContent = e.target.value;
        saveSettings();
    });

    // Initialization
    loadDataFromLocalstorage();
    loadSettings();
    sendButton.addEventListener("click", handleOutgoingChat);
});