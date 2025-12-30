const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const svgInput = document.getElementById("svg-path");
const rigInput = document.getElementById("rig-path");
const loadButton = document.getElementById("load");
const boneSelect = document.getElementById("bone");
const angleSlider = document.getElementById("angle");
const resetButton = document.getElementById("reset");
const statusEl = document.getElementById("status");

const state = {
  rig: null,
  bones: new Map(),
  children: new Map(),
  positions: new Map(),
  angles: new Map(),
  image: null,
  imageReady: false,
};

function setStatus(message) {
  statusEl.textContent = message;
}

function buildRigMaps(rig) {
  const bones = new Map();
  const children = new Map();
  rig.bones.forEach((bone) => {
    bones.set(bone.name, {
      ...bone,
      localOffset: [0, 0],
    });
    children.set(bone.name, []);
  });

  bones.forEach((bone) => {
    if (bone.parent) {
      const parent = bones.get(bone.parent);
      if (parent) {
        bone.localOffset = [
          bone.pivot[0] - parent.pivot[0],
          bone.pivot[1] - parent.pivot[1],
        ];
        children.get(bone.parent).push(bone.name);
      }
    }
  });

  return { bones, children };
}

function rotate([x, y], angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x * cos - y * sin, x * sin + y * cos];
}

function computePose(rig) {
  const positions = new Map();
  const rootName = rig.root;

  function walk(name, parentPos, parentAngle) {
    const bone = state.bones.get(name);
    const angle = parentAngle + (state.angles.get(name) || 0);
    const pos = parentPos
      ? (() => {
          const rotated = rotate(bone.localOffset, parentAngle);
          return [parentPos[0] + rotated[0], parentPos[1] + rotated[1]];
        })()
      : bone.pivot;

    positions.set(name, { pos, angle });

    const kids = state.children.get(name) || [];
    kids.forEach((child) => walk(child, pos, angle));
  }

  walk(rootName, null, 0);
  return positions;
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawRig() {
  if (!state.rig || !state.imageReady) return;

  const { viewBox } = state.rig;
  const width = viewBox[2];
  const height = viewBox[3];
  const scale = Math.min(canvas.width / width, canvas.height / height) * 0.85;
  const offsetX = (canvas.width - width * scale) / 2;
  const offsetY = (canvas.height - height * scale) / 2;

  clearCanvas();

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.drawImage(state.image, 0, 0, width, height);

  state.positions = computePose(state.rig);

  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(43, 43, 43, 0.6)";
  ctx.fillStyle = "rgba(224, 75, 58, 0.7)";

  state.positions.forEach((data, name) => {
    const bone = state.bones.get(name);
    if (bone.parent) {
      const parent = state.positions.get(bone.parent);
      if (parent) {
        ctx.beginPath();
        ctx.moveTo(parent.pos[0], parent.pos[1]);
        ctx.lineTo(data.pos[0], data.pos[1]);
        ctx.stroke();
      }
    }
  });

  state.positions.forEach((data, name) => {
    const isSelected = boneSelect.value === name;
    ctx.beginPath();
    ctx.arc(data.pos[0], data.pos[1], isSelected ? 2.6 : 2, 0, Math.PI * 2);
    ctx.fillStyle = isSelected
      ? "rgba(224, 75, 58, 0.9)"
      : "rgba(43, 43, 43, 0.6)";
    ctx.fill();
  });

  if (state.rig.attachments) {
    ctx.strokeStyle = "rgba(93, 187, 99, 0.9)";
    state.rig.attachments.forEach((attachment) => {
      const bonePose = state.positions.get(attachment.bone);
      if (!bonePose) return;
      const rotated = rotate(attachment.offset || [0, 0], bonePose.angle);
      const x = bonePose.pos[0] + rotated[0];
      const y = bonePose.pos[1] + rotated[1];
      ctx.beginPath();
      ctx.moveTo(x - 2, y);
      ctx.lineTo(x + 2, y);
      ctx.moveTo(x, y - 2);
      ctx.lineTo(x, y + 2);
      ctx.stroke();
    });
  }

  ctx.restore();
}

function populateBones(rig) {
  boneSelect.innerHTML = "";
  rig.bones.forEach((bone) => {
    const option = document.createElement("option");
    option.value = bone.name;
    option.textContent = bone.name;
    boneSelect.appendChild(option);
  });
  if (rig.bones.length > 0) {
    boneSelect.value = rig.bones[0].name;
  }
}

function resetAngles() {
  state.angles.clear();
  rigDefaultAngles();
  angleSlider.value = "0";
  drawRig();
}

function rigDefaultAngles() {
  if (!state.rig) return;
  state.rig.bones.forEach((bone) => {
    state.angles.set(bone.name, 0);
  });
}

async function loadRigAssets() {
  setStatus("Loading rig...");
  try {
    const rigResponse = await fetch(rigInput.value);
    if (!rigResponse.ok) {
      throw new Error(`Rig load failed: ${rigResponse.status}`);
    }
    const rig = await rigResponse.json();
    const image = new Image();
    image.onload = () => {
      state.imageReady = true;
      drawRig();
    };
    image.onerror = () => {
      state.imageReady = false;
      setStatus("Failed to load SVG image.");
    };
    image.src = svgInput.value;

    state.rig = rig;
    state.image = image;
    state.imageReady = false;

    const maps = buildRigMaps(rig);
    state.bones = maps.bones;
    state.children = maps.children;
    rigDefaultAngles();
    populateBones(rig);
    setStatus("Rig loaded.");
  } catch (error) {
    setStatus(`Error: ${error.message}`);
  }
}

boneSelect.addEventListener("change", () => {
  const angle = state.angles.get(boneSelect.value) || 0;
  angleSlider.value = String(Math.round((angle * 180) / Math.PI));
  drawRig();
});

angleSlider.addEventListener("input", () => {
  const degrees = Number(angleSlider.value);
  state.angles.set(boneSelect.value, (degrees * Math.PI) / 180);
  drawRig();
});

resetButton.addEventListener("click", resetAngles);
loadButton.addEventListener("click", loadRigAssets);

loadRigAssets();
