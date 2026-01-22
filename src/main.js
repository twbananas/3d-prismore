import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";

// Main class that sets up the scene, bloom, and interaction
class SelectiveBloomCubes {
  constructor() {
    this.bloom = false;
    this.tcontrol = null;
    this.axisVisible = false;
    this.gridVisible = false;
    this.orbitControls = false;
    this.mouseMoveAnim = false;
    this.delay = 1;
    this.gModel = new THREE.Group();
    this.gMain = new THREE.Group();
    this.params = {
      threshold: 0,
      strength: 2,
      radius: 0.4,
      exposure: 1,
    };
    this.modlePosition = {
      x: -4,
      y: 1.493,
      z: 2.146,
    };
    this.init();
    // this.DatGUI();
    this.initBloom();
    this.addCubes();
    this.addLights();
    this.animate();
    document.body.style.overflow = "hidden";
    console.log("document.innerWidth", window.innerWidth);

    if (window.innerWidth < 500) {
      this.modlePosition = {
        x: 2,
        y: 1.493,
        z: 2.146,
      };
    }
  }

  init() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas: document.getElementById("drawcanvas"),
      alpha: true,
    });
    const dracoLoader = new DRACOLoader();
    this.gltfLoader = new GLTFLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
    // dracoLoader.setDecoderPath("https://Prismore.b-cdn.net/index-Bdpj-q_I.js");
    this.gltfLoader.setDRACOLoader(dracoLoader);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();
    // Define the aspect ratio
    const aspect = window.innerWidth / window.innerHeight;

    // Define the frustum size
    const frustumSize = 10;

    // Create an OrthographicCamera
    this.camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      100
    );

    this.camera.position.set(0, -1, 6);

    // Add this in your scene setup, possibly in the constructor or an initialization method
    // this.scene.fog = new THREE.Fog("0x000000", 0.5, 1); // Linear fog
    // Or for exponential fog
    this.scene.fog = new THREE.FogExp2(0x000000, 0.03);

    // Camera controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.axis = new THREE.AxesHelper(10);
    this.grid = new THREE.GridHelper(50, 50);
    this.axis.visible = this.axisVisible;
    this.grid.visible = this.gridVisible;
    this.scene.add(this.axis);
    this.scene.add(this.grid);
    this.controls.enabled = this.orbitControls;
    this.scene.add(this.gMain);
    this.gMain.add(this.gModel);
    this.gMain.position.set(0, 0, 0);
    this.gModel.position.set(0, 0, 0);
  }

  DatGUI() {
    // Add GUI controls
    this.gui = new GUI();

    this.gui.add(this, "axisVisible").name("Axis Visible");
    this.gui.add(this, "gridVisible").name("Grid Visible");
    this.dat_control = this.gui
      .add(this, "orbitControls")
      .name("Orbit Controls");
  }

  initBloom() {
    // Layer for bloom effect
    this.BLOOM_SCENE = 1;
    this.bloomLayer = new THREE.Layers();
    this.bloomLayer.set(this.BLOOM_SCENE);

    // Bloom parameters (editable via GUI)

    // Used to darken non-bloomed objects during bloom pass
    this.darkMaterial = new THREE.MeshBasicMaterial({ color: "black" });
    this.materials = {};
    // Bloom pass setup
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      this.params.strength,
      this.params.radius,
      this.params.threshold
    );

    // Composer for bloom pass (renders only bloom layer)
    this.bloomComposer = new EffectComposer(this.renderer);
    this.bloomComposer.renderToScreen = false;
    this.bloomComposer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomComposer.addPass(this.bloomPass);

    // Composer for final pass (combines normal and bloom)
    this.finalComposer = new EffectComposer(this.renderer);
    this.finalComposer.addPass(new RenderPass(this.scene, this.camera));

    // Shader to combine base and bloom textures
    this.finalPass = new ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: {
          baseTexture: { value: null },
          bloomTexture: { value: this.bloomComposer.renderTarget2.texture },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D baseTexture;
          uniform sampler2D bloomTexture;
          varying vec2 vUv;
          void main() {
            vec4 base = texture2D(baseTexture, vUv);
            vec4 bloom = texture2D(bloomTexture, vUv);
            
            gl_FragColor = vec4(base.rgb + bloom.rgb, base.a);
          }
        `,
        defines: {},
      }),
      "baseTexture"
    );
    this.finalPass.needsSwap = true;
    this.finalComposer.addPass(this.finalPass);
  }

  // Add cubes to the scene, some with bloom enabled
  addCubes() {
    const tl = gsap.timeline();
    this.gltfLoader.load(
      "https://Prismore.b-cdn.net/prismore5.glb",
      // ".././public/prismore5.glb",
      (gltf) => {
        const model = gltf.scene;

        model.position.set(0, 0, 0);
        model.scale.set(0.2, 0.2, 0.1);
        model.traverse((child) => {
          if (child.isMesh) {
            child.material.matelness = 0.1;
            child.material.roughness = 0.5;
            child.material.color.set("#6EB744");
            child.material.depthTest = true;
            child.material.depthWrite = true;
            child.material.transparent = true;
            child.material.opacity = 0;

            tl.to(child.material, {
              opacity: 1,
              duration: 3,
              delay: 0,
              ease: "power2.inOut",
            });
          }
        });
        this.Tcontrol(this.gModel);
        gsap.to(this.gModel.position, { x: 0, y: 0, z: 0, duration: 0.1 });
        gsap.to(this.gModel.rotation, { x: 0.109, y: -0.05, z: 0.005 });
        tl.to(
          this.gModel.scale,
          {
            x: 7.5,
            y: 7.5,
            z: 7.5,
            duration: 1,
            ease: "power2.inOut",
          },
          "-=1.3"
        );
        tl.fromTo(
          this.gModel.rotation,
          { x: 0.109, y: -0.05, z: 0.005 },
          {
            x: 0.106,
            y: 0.029,
            z: -0.578,
            duration: 1,
            ease: "power2.inOut",
          },
          "-=1.3"
        );
        // tl.fromTo(
        //   this.gModel.position,
        //   { x: 0, y: 0, z: 0 },
        //   {
        //     x: -3.472,
        //     y: 1.493,
        //     z: 2.146,
        //     duration: 1,
        //     ease: "power2.inOut",
        //   },
        //   "-=1"
        // );

        tl.fromTo(
          this.gModel.position,
          { x: 0, y: 0, z: 0 },
          {
            x: this.modlePosition.x,
            y: this.modlePosition.y,
            z: this.modlePosition.z,
            duration: 1,
            ease: "power2.inOut",
            onComplete: () => {
              document.body.style.overflow = "auto";
            },
          },
          "-=1.3"
        );
        gsap.fromTo(
          this.gModel.rotation,
          { x: 0.106, y: 0.029, z: -0.578 },
          {
            x: 0.124,
            y: 0.16,
            z: -0.576,
            duration: 1,
            ease: "power2.inOut",
            scrollTrigger: {
              trigger: document.querySelector(".section2"),
              start: "top bottom",
              end: "bottom bottom",
              scrub: 1,
              // markers: true,
            },
          }
        );
        gsap.fromTo(
          this.gModel.position,
          { x: this.modlePosition.x, y: this.modlePosition.y, z: this.modlePosition.z },
          {
            x: -8.097,
            y: 4.662,
            z: 2.124,
            duration: 1,
            ease: "power2.inOut",
            scrollTrigger: {
              trigger: document.querySelector(".section2"),
              start: "top bottom",
              end: "bottom bottom",
              scrub: 1,
              // markers: true,
            },
          }
        );

        this.mousemoveactive = true;

        // this.Tcontrol(this.gModel);
        const numberOfClones = 60;
        let cloneModels = [];
        let previousClone = model;

        for (let i = 0; i < numberOfClones; i++) {
          const clone = model.clone();
          this.gModel.add(clone);
          cloneModels.push(clone);
          previousClone = clone;
        }
        for (let i = 1; i < numberOfClones; i++) {
          gsap.to(cloneModels[i - 1].rotation, {
            z: -(Math.PI / 1000) * i,
            duration: 1,
            ease: "power2.inOut",
            delay: this.delay,
            onStart: () => {
              // Disable scrolling
              document.body.style.overflow = "hidden";
            },
          });
          gsap.to(cloneModels[i - 1].position, {
            z: -i * 0.03,
            duration: 1,
            ease: "power2.inOut",
            delay: this.delay,
            onStart: () => {
              // Disable scrolling
              document.body.style.overflow = "hidden";
            },
            // onComplete: () => {
            //   // Enable scrolling
            //   document.body.style.overflow = "auto";
            // },
          });
        }

        // Add event listener for mouse move
      }
    );

    this.mousemoveactive = false;
    ScrollTrigger.create({
      trigger: document.querySelector(".section2"),
      start: "top 80%",
      end: "bottom bottom",
      // markers: true,
      onEnter: () => {
        this.mousemoveactive = true;
      },
      onLeave: () => {
        this.mousemoveactive = true; // Keep mouse active even at the bottom
      },
      onEnterBack: () => {
        this.mousemoveactive = true;
      },
      onLeaveBack: () => {
        this.mousemoveactive = true; // Keep mouse active when scrolling back up
      },
    });

    this.onTriggerActivated("enter", 300);
  }

  onTriggerActivated(type, speed) {
    console.log("type", type);

    // Store the event listener function in a variable
    const handleMouseMove = (event) => {
      console.log("this.mousemoveactive", this.mousemoveactive);
      if (this.mousemoveactive) {
        // Calculate rotation based on mouse position
        const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;

        this.gMain.rotation.y = mouseX * 0.02;
        this.gMain.rotation.x = mouseY * 0.02;

        // Store previous rotation values
        const previousRotationY = this.gMain.rotation.y;
        const previousRotationX = this.gMain.rotation.x;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
  }

  addLights() {
    // Main ambient light - very low to create darker atmosphere
    const ambientLight = new THREE.AmbientLight("#2a2a2a", 0.3);
    this.scene.add(ambientLight);

    // Key lights with reduced intensity for darker mood
    const light = new THREE.PointLight("#74A552", 200); // Reduced from 500
    const light1 = new THREE.PointLight("#74A552", 50);  // Reduced from 100
    const light2 = new THREE.PointLight("#74A552", 150); // Reduced from 300
    const light3 = new THREE.PointLight("#74A552", 150); // Reduced from 300
    const light4 = new THREE.PointLight("#74A552", 50);  // Reduced from 100
    
    // Add some darker accent lights
    const darkAccent1 = new THREE.PointLight("#1a1a1a", 80);
    const darkAccent2 = new THREE.PointLight("#2d2d2d", 60);
    
    light.position.set(4.486, 13.285, -20.608);
    light1.position.set(-1.124, -4, -0.961);
    light2.position.set(-4.584, 1.934, -0.118);
    light3.position.set(4.567, 3.043, 0.722);
    light4.position.set(2.037, -3.544, -0.579);
    
    // Position darker accent lights for dramatic effect
    darkAccent1.position.set(0, -8, -5);
    darkAccent2.position.set(-6, 2, 3);
    
    // this.Tcontrol(light);
    // this.Tcontrol(light1);
    // this.Tcontrol(light2);
    // this.Tcontrol(light3);
    // this.Tcontrol(light4);
    this.scene.add(light, light1, light2, light3, light4, darkAccent1, darkAccent2);
  }

  // Helper: darken objects not in bloom layer (for bloom pass)
  darkenNonBloomed(obj) {
    if (obj.isMesh && this.bloomLayer.test(obj.layers) === false) {
      this.materials[obj.uuid] = obj.material;
      obj.material = this.darkMaterial;
    }
  }

  restoreMaterial(obj) {
    if (this.materials[obj.uuid]) {
      obj.material = this.materials[obj.uuid];
      delete this.materials[obj.uuid];
    }
  }

  render() {
    if (this.bloom) {
      // 1. Darken non-bloomed objects, render bloom pass
      this.scene.traverse(this.darkenNonBloomed.bind(this));
      this.bloomComposer.render();
      // 2. Restore original materials
      this.scene.traverse(this.restoreMaterial.bind(this));
      // 3. Set up final pass uniforms and render final composite
      this.finalPass.uniforms["baseTexture"].value =
        this.finalComposer.readBuffer.texture;
      this.finalPass.uniforms["bloomTexture"].value =
        this.bloomComposer.renderTarget2.texture;
      this.finalComposer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // Animation loop
  // ... (all your existing code above) ...

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.controls.update();
    this.axis.visible = this.axisVisible;
    this.grid.visible = this.gridVisible;
    this.render();
    this.axis.visible = this.axisVisible;
    this.grid.visible = this.gridVisible;
    this.controls.enabled = this.orbitControls;
    if (this.gMain) {
      // this.gModel.rotation.x += 0.0008;
      // this.gMain.rotation.z += 0.0008;
      // this.gModel.rotation.z = 6.3;
      // console.log(this.gModel.rotation.z);
    }
  }

  Tcontrol(mesh) {
    this.tcontrol = new TransformControls(
      this.camera,
      this.renderer.domElement
    );
    const gizmo = this.tcontrol.getHelper();
    this.scene.add(gizmo);
    this.tcontrol.attach(mesh);
    this.tcontrol.setMode("translate");
    
    // Hide the 3D gizmo, we'll use manual controls instead
    this.tcontrol.visible = false;
    
    // Create fixed UI controls overlay
    this.createFixedControls(mesh);
    
    this.tcontrol.addEventListener("change", (e) => {
      switch (this.tcontrol.mode) {
        case "translate":
          console.log({
            x: parseFloat(mesh.position.x.toFixed(3)),
            y: parseFloat(mesh.position.y.toFixed(3)),
            z: parseFloat(mesh.position.z.toFixed(3)),
          });
          break;
        case "rotate":
          console.log({
            x: parseFloat(mesh.rotation.x.toFixed(3)),
            y: parseFloat(mesh.rotation.y.toFixed(3)),
            z: parseFloat(mesh.rotation.z.toFixed(3)),
          });
          break;
        case "scale":
          console.log({
            x: parseFloat(mesh.scale.x.toFixed(3)),
            y: parseFloat(mesh.scale.y.toFixed(3)),
            z: parseFloat(mesh.scale.z.toFixed(3)),
          });
          break;
      }
    });

    const self = this;
    window.addEventListener("keydown", function (event) {
      if (event.key === " ") {
        self.orbitControls = !self.orbitControls;
        if (self.dat_control) {
          self.dat_control.setValue(self.orbitControls);
        }
      }
      
      if (event.key === "h" || event.key === "H") {
        const controlPanel = document.getElementById('transform-controls');
        if (controlPanel) {
          controlPanel.style.display = controlPanel.style.display === 'none' ? 'block' : 'none';
        }
      }
      
      if (self.tcontrol) {
        switch (event.key) {
          case "q":
            self.tcontrol.setSpace(
              self.tcontrol.space === "local" ? "world" : "local"
            );
            break;

          case "Shift":
            self.tcontrol.setTranslationSnap(1);
            self.tcontrol.setRotationSnap(THREE.MathUtils.degToRad(15));
            self.tcontrol.setScaleSnap(0.25);
            break;

          case "w":
            self.tcontrol.setMode("translate");
            self.updateControlsUI();
            break;

          case "r":
            self.tcontrol.setMode("rotate");
            self.updateControlsUI();
            break;

          case "s":
            self.tcontrol.setMode("scale");
            self.updateControlsUI();
            break;

          case "+":
          case "=":
            self.tcontrol.setSize(self.tcontrol.size + 0.1);
            break;

          case "-":
          case "_":
            self.tcontrol.setSize(Math.max(self.tcontrol.size - 0.1, 0.1));
            break;

          case "x":
            self.tcontrol.showX = !self.tcontrol.showX;
            break;

          case "y":
            self.tcontrol.showY = !self.tcontrol.showY;
            break;

          case "z":
            self.tcontrol.showZ = !self.tcontrol.showZ;
            break;

          case "Escape":
            self.tcontrol.reset();
            break;
        }
      }
    });
  }

  createFixedControls(mesh) {
    // Create control panel
    const controlPanel = document.createElement('div');
    controlPanel.id = 'transform-controls';
    controlPanel.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      border: 1px solid #74A552;
      border-radius: 8px;
      padding: 15px;
      color: #74A552;
      font-family: monospace;
      font-size: 12px;
      z-index: 1000;
      min-width: 250px;
    `;

    controlPanel.innerHTML = `
      <div style="margin-bottom: 10px; font-weight: bold; border-bottom: 1px solid #74A552; padding-bottom: 5px;">
        Transform Controls
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Mode:</strong> <span id="current-mode">Translate</span>
      </div>
      <div style="margin-bottom: 12px; display: flex; gap: 5px; flex-wrap: wrap;">
        <button id="btn-translate" style="padding: 8px 12px; background: #74A552; color: black; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Translate (W)</button>
        <button id="btn-rotate" style="padding: 8px 12px; background: #555; color: white; border: none; border-radius: 4px; cursor: pointer;">Rotate (R)</button>
        <button id="btn-scale" style="padding: 8px 12px; background: #555; color: white; border: none; border-radius: 4px; cursor: pointer;">Scale (S)</button>
      </div>
      <div style="margin-bottom: 12px;">
        <div style="margin-bottom: 8px; font-weight: bold;">Manual Controls:</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; margin-bottom: 8px;">
          <button id="btn-x-pos" style="padding: 5px; background: #74A552; color: black; border: none; border-radius: 3px; cursor: pointer;">X+</button>
          <button id="btn-y-pos" style="padding: 5px; background: #74A552; color: black; border: none; border-radius: 3px; cursor: pointer;">Y+</button>
          <button id="btn-z-pos" style="padding: 5px; background: #74A552; color: black; border: none; border-radius: 3px; cursor: pointer;">Z+</button>
          <button id="btn-x-neg" style="padding: 5px; background: #333; color: white; border: none; border-radius: 3px; cursor: pointer;">X-</button>
          <button id="btn-y-neg" style="padding: 5px; background: #333; color: white; border: none; border-radius: 3px; cursor: pointer;">Y-</button>
          <button id="btn-z-neg" style="padding: 5px; background: #333; color: white; border: none; border-radius: 3px; cursor: pointer;">Z-</button>
        </div>
        <div style="display: flex; gap: 5px;">
          <input type="range" id="step-size" min="0.01" max="1" step="0.01" value="0.1" style="flex: 1;">
          <span id="step-value" style="min-width: 40px;">0.1</span>
        </div>
      </div>
      <div style="font-size: 10px; opacity: 0.7; margin-top: 10px; line-height: 1.4;">
        Q - Toggle Space<br>
        X/Y/Z - Toggle Axis<br>
        +/- - Adjust Gizmo Size<br>
        H - Hide/Show Panel<br>
        ESC - Reset
      </div>
    `;

    document.body.appendChild(controlPanel);

    // Store the mesh reference
    this.controlledMesh = mesh;
    this.stepSize = 0.1;

    // Add button click handlers
    const self = this;
    
    // Step size control
    document.getElementById('step-size').addEventListener('input', (e) => {
      self.stepSize = parseFloat(e.target.value);
      document.getElementById('step-value').textContent = self.stepSize.toFixed(2);
    });

    // Mode buttons
    document.getElementById('btn-translate').addEventListener('click', () => {
      self.tcontrol.setMode("translate");
      self.updateControlsUI();
    });
    
    document.getElementById('btn-rotate').addEventListener('click', () => {
      self.tcontrol.setMode("rotate");
      self.updateControlsUI();
    });
    
    document.getElementById('btn-scale').addEventListener('click', () => {
      self.tcontrol.setMode("scale");
      self.updateControlsUI();
    });

    // Manual transform buttons
    document.getElementById('btn-x-pos').addEventListener('click', () => self.manualTransform('x', 1));
    document.getElementById('btn-x-neg').addEventListener('click', () => self.manualTransform('x', -1));
    document.getElementById('btn-y-pos').addEventListener('click', () => self.manualTransform('y', 1));
    document.getElementById('btn-y-neg').addEventListener('click', () => self.manualTransform('y', -1));
    document.getElementById('btn-z-pos').addEventListener('click', () => self.manualTransform('z', 1));
    document.getElementById('btn-z-neg').addEventListener('click', () => self.manualTransform('z', -1));
  }

  manualTransform(axis, direction) {
    const mesh = this.controlledMesh;
    if (!mesh) return;

    const step = this.stepSize * direction;

    switch (this.tcontrol.mode) {
      case 'translate':
        mesh.position[axis] += step;
        console.log('Position:', {
          x: parseFloat(mesh.position.x.toFixed(3)),
          y: parseFloat(mesh.position.y.toFixed(3)),
          z: parseFloat(mesh.position.z.toFixed(3)),
        });
        break;
      case 'rotate':
        mesh.rotation[axis] += step;
        console.log('Rotation:', {
          x: parseFloat(mesh.rotation.x.toFixed(3)),
          y: parseFloat(mesh.rotation.y.toFixed(3)),
          z: parseFloat(mesh.rotation.z.toFixed(3)),
        });
        break;
      case 'scale':
        mesh.scale[axis] += step;
        console.log('Scale:', {
          x: parseFloat(mesh.scale.x.toFixed(3)),
          y: parseFloat(mesh.scale.y.toFixed(3)),
          z: parseFloat(mesh.scale.z.toFixed(3)),
        });
        break;
    }
  }

  updateControlsUI() {
    const modeText = document.getElementById('current-mode');
    const btnTranslate = document.getElementById('btn-translate');
    const btnRotate = document.getElementById('btn-rotate');
    const btnScale = document.getElementById('btn-scale');
    
    if (!modeText) return;
    
    // Reset all buttons
    btnTranslate.style.background = '#555';
    btnRotate.style.background = '#555';
    btnScale.style.background = '#555';
    
    // Highlight active mode
    switch (this.tcontrol.mode) {
      case 'translate':
        modeText.textContent = 'Translate';
        btnTranslate.style.background = '#74A552';
        break;
      case 'rotate':
        modeText.textContent = 'Rotate';
        btnRotate.style.background = '#74A552';
        break;
      case 'scale':
        modeText.textContent = 'Scale';
        btnScale.style.background = '#74A552';
        break;
    }
  }
} // <-- This closes the SelectiveBloomCubes class

// Start the app
new SelectiveBloomCubes();
