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
    this.initBloom();
    this.addCubes();
    this.addLights();
    this.animate();
    
    document.body.style.overflow = "hidden";
    console.log("Window Width:", window.innerWidth);

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
    
    // Fixed DRACO decoder path
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/");
    this.gltfLoader.setDRACOLoader(dracoLoader);
    
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 10;

    this.camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      100
    );

    this.camera.position.set(0, -1, 6);

    this.scene.fog = new THREE.FogExp2(0x000000, 0.03);

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

  initBloom() {
    this.BLOOM_SCENE = 1;
    this.bloomLayer = new THREE.Layers();
    this.bloomLayer.set(this.BLOOM_SCENE);

    this.darkMaterial = new THREE.MeshBasicMaterial({ color: "black" });
    this.materials = {};
    
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      this.params.strength,
      this.params.radius,
      this.params.threshold
    );

    this.bloomComposer = new EffectComposer(this.renderer);
    this.bloomComposer.renderToScreen = false;
    this.bloomComposer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomComposer.addPass(this.bloomPass);

    this.finalComposer = new EffectComposer(this.renderer);
    this.finalComposer.addPass(new RenderPass(this.scene, this.camera));

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

  addCubes() {
    const tl = gsap.timeline();
    
    // Use a reliable model URL or your own
    const modelUrl = "https://threejs.org/examples/models/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf";
    
    this.gltfLoader.load(
      modelUrl,
      (gltf) => {
        console.log("✓ Model loaded successfully");
        const model = gltf.scene;

        model.position.set(0, 0, 0);
        model.scale.set(0.2, 0.2, 0.1);
        model.traverse((child) => {
          if (child.isMesh) {
            child.material.metalness = 0.1;
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
            },
          }
        );

        this.mousemoveactive = true;

        const numberOfClones = 60;
        let cloneModels = [];

        for (let i = 0; i < numberOfClones; i++) {
          const clone = model.clone();
          this.gModel.add(clone);
          cloneModels.push(clone);
        }

        for (let i = 1; i < numberOfClones; i++) {
          gsap.to(cloneModels[i - 1].rotation, {
            z: -(Math.PI / 1000) * i,
            duration: 1,
            ease: "power2.inOut",
            delay: this.delay,
            onStart: () => {
              document.body.style.overflow = "hidden";
            },
          });
          
          gsap.to(cloneModels[i - 1].position, {
            z: -i * 0.03,
            duration: 1,
            ease: "power2.inOut",
            delay: this.delay,
          });
        }

        this.onTriggerActivated("enter", 300);
      },
      (progress) => {
        console.log("Loading:", (progress.loaded / progress.total * 100).toFixed(0) + "%");
      },
      (error) => {
        console.error("✗ Failed to load model:", error);
      }
    );

    this.mousemoveactive = false;
    
    if (document.querySelector(".section2")) {
      ScrollTrigger.create({
        trigger: document.querySelector(".section2"),
        start: "top 80%",
        end: "bottom bottom",
        onEnter: () => {
          this.mousemoveactive = true;
        },
        onLeave: () => {
          this.mousemoveactive = true;
        },
        onEnterBack: () => {
          this.mousemoveactive = true;
        },
        onLeaveBack: () => {
          this.mousemoveactive = true;
        },
      });
    }
  }

  onTriggerActivated(type, speed) {
    const handleMouseMove = (event) => {
      if (this.mousemoveactive) {
        const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;

        this.gMain.rotation.y = mouseX * 0.02;
        this.gMain.rotation.x = mouseY * 0.02;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
  }

  addLights() {
    const ambientLight = new THREE.AmbientLight("#2a2a2a", 0.3);
    this.scene.add(ambientLight);

    const light = new THREE.PointLight("#74A552", 200);
    const light1 = new THREE.PointLight("#74A552", 50);
    const light2 = new THREE.PointLight("#74A552", 150);
    const light3 = new THREE.PointLight("#74A552", 150);
    const light4 = new THREE.PointLight("#74A552", 50);
    
    const darkAccent1 = new THREE.PointLight("#1a1a1a", 80);
    const darkAccent2 = new THREE.PointLight("#2d2d2d", 60);
    
    light.position.set(4.486, 13.285, -20.608);
    light1.position.set(-1.124, -4, -0.961);
    light2.position.set(-4.584, 1.934, -0.118);
    light3.position.set(4.567, 3.043, 0.722);
    light4.position.set(2.037, -3.544, -0.579);
    darkAccent1.position.set(0, -8, -5);
    darkAccent2.position.set(-6, 2, 3);
    
    this.scene.add(light, light1, light2, light3, light4, darkAccent1, darkAccent2);
  }

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
      this.scene.traverse(this.darkenNonBloomed.bind(this));
      this.bloomComposer.render();
      this.scene.traverse(this.restoreMaterial.bind(this));
      this.finalPass.uniforms["baseTexture"].value = this.finalComposer.readBuffer.texture;
      this.finalPass.uniforms["bloomTexture"].value = this.bloomComposer.renderTarget2.texture;
      this.finalComposer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.controls.update();
    this.axis.visible = this.axisVisible;
    this.grid.visible = this.gridVisible;
    this.render();
    this.controls.enabled = this.orbitControls;
  }

  Tcontrol(mesh) {
    this.tcontrol = new TransformControls(this.camera, this.renderer.domElement);
    const gizmo = this.tcontrol.getHelper();
    this.scene.add(gizmo);
    this.tcontrol.attach(mesh);
    this.tcontrol.setMode("translate");
  }
}

// Initialize the app
export default async function init(config = {}) {
  const app = new SelectiveBloomCubes();
  return {
    mesh: app.gModel,
    camera: app.camera,
    renderer: app.renderer,
    controls: app.controls,
    gModel: app.gModel,
    gMain: app.gMain,
    render: () => app.render(),
  };
}

new SelectiveBloomCubes();
