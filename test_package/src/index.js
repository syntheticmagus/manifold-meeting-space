import { IManifoldMeetingSpaceOptions, ManifoldMeetingSpaceExperience } from "app_package";

document.body.style.width = "100%";
document.body.style.height = "100%";
document.body.style.margin = "0";
document.body.style.padding = "0";

const title = document.createElement("p");
title.innerText = "Manifold Meeting Space";
title.style.fontSize = "32pt";
title.style.textAlign = "center";
document.body.appendChild(title);

const canvasDiv = document.createElement("div");
canvasDiv.style.width = "60%";
canvasDiv.style.margin = "0 auto";
canvasDiv.style.aspectRatio = "16 / 9";
document.body.appendChild(canvasDiv);

const canvas = document.createElement("canvas");
canvas.id = "renderCanvas";
canvas.style.width = "100%";
canvas.style.height = "100%";
canvas.style.display = "block";
canvasDiv.appendChild(canvas);

const joinDiv = document.createElement("div");
joinDiv.style.width = "200px";
joinDiv.style.margin = "0 auto";
document.body.appendChild(joinDiv);

joinDiv.appendChild(document.createElement("hr"));

const spaceName = document.createElement("input");
spaceName.type = "text";
spaceName.style.width = "95%";
joinDiv.appendChild(spaceName);

joinDiv.appendChild(document.createElement("hr"));

const button = document.createElement("button");
button.id = "button";
button.textContent = "Join";
button.style.width = "100%";
joinDiv.appendChild(button);

let assetsHostUrl;
let registryUrl;
if (DEV_BUILD) {
    assetsHostUrl = "http://127.0.0.1:8181/";
    registryUrl = "http://127.0.0.1:3000/";
} else {
    assetsHostUrl = "https://syntheticmagus.github.io/manifold-meeting-space-assets/";
    registryUrl = "https://manifold-meeting-space.herokuapp.com/";
}

const options = { canvas: canvas, assetsHostUrl: assetsHostUrl, registryUrl: registryUrl };
const experience = new ManifoldMeetingSpaceExperience(options);

let joined = false;
button.onclick = () => {
    if (joined) {
        experience.leaveSpace();
        joined = false;
        button.textContent = "Join";
    } else {
        if (spaceName.value.length > 0) {
            experience.joinSpace(spaceName.value);
            joined = true;
            button.textContent = "Leave";
        }
    }
};