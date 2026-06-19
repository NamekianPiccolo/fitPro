import re

html_path = 'templates/index.html'
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Remove Auto button
html = re.sub(r'<button class="btn-mode active" data-mode="Auto".*?</button>', '', html, flags=re.DOTALL)
html = re.sub(r'<button class="btn-mode" data-mode="Auto".*?</button>', '', html, flags=re.DOTALL)
# Make Squats active
html = html.replace('<button class="btn-mode" data-mode="Squats"', '<button class="btn-mode active" data-mode="Squats"')
# Remove Russian Twists button
html = re.sub(r'<button class="btn-mode" data-mode="Russian twists".*?</button>', '', html, flags=re.DOTALL)
# Update HUD default text
html = html.replace('<span id="hud-predicted-label">Auto AI</span>', '<span id="hud-predicted-label">SQUATS</span>')

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)
print("HTML modified successfully.")


js_path = 'static/script.js'
with open(js_path, 'r', encoding='utf-8') as f:
    js = f.read()

# 1. Default trainingMode
js = js.replace("let trainingMode = 'Auto';", "let trainingMode = 'Squats';")

# 2. onResults exerciseToTrack
js = js.replace("const exerciseToTrack = (trainingMode === 'Auto') ? predictedLabel.textContent : trainingMode;", "const exerciseToTrack = trainingMode;")

# 3. trackRepetitions init block for Russian Twists
js = re.sub(r"\} else if \(predictedExercise === 'Russian twists'.*?minHipAngle = hipAngle;.*?\}", "}", js, flags=re.DOTALL)

# 4. trackRepetitions logic for Russian Twists
js = re.sub(r"\} else if \(activeExercise === 'Russian twists'\) \{.*?\} else if \(activeExercise === 'Jumping Jacks'\) \{", "} else if (activeExercise === 'Jumping Jacks') {", js, flags=re.DOTALL)

# 5. updateFormFeedback for Russian Twists
js = re.sub(r"\} else if \(exercise === 'Russian twists'\) \{.*?\} else if \(exercise === 'Jumping Jacks'\) \{", "} else if (exercise === 'Jumping Jacks') {", js, flags=re.DOTALL)

# 6. Click handler Auto reset - not needed to remove if we remove the button, but good practice
js = re.sub(r"\} else if \(trainingMode === 'Russian twists'\) \{\s*repStage = 'center';", "", js)

# 7. Button listeners "Auto" specific UI logic
js = re.sub(r"// Update UI elements based on selected mode.*?if \(trainingMode !== 'Auto'\) \{", "// Update UI elements based on selected mode\n        if (true) {", js, flags=re.DOTALL)
# We can just leave the if (true) there, it's fine.

# 8. Guide Text
js = re.sub(r"\} else if \(trainingMode === 'Russian twists'\) \{\s*guideText\.innerHTML = '<i class=\"fa-solid fa-circle-check\"></i> <b>Latihan Russian Twists Aktif!</b> Harap duduk menghadap samping kamera agar AI melacak rotasi badan dan sudut pinggul Anda\.';", "", js)

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(js)
print("JS modified successfully.")
