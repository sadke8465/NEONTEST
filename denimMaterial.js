// denimMaterial.js
export function createDenimFurMaterial(THREE) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uBaseColor: { value: new THREE.Color(0x05070c) },
            uMidColor: { value: new THREE.Color(0x141b25) },
            uHighlight: { value: new THREE.Color(0x3c4e62) },
            uNoiseScale: { value: new THREE.Vector2(3.0, 20.0) },
            uDisplaceAmt: { value: 0.12 },
            uLightDir: { value: new THREE.Vector3(0.3, 0.8, 0.4).normalize() },
        },
        vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      uniform vec2 uNoiseScale;
      uniform float uDisplaceAmt;
      uniform float uTime;

      vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
      vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise(vec3 v){
        const vec2  C = vec2(1.0/6.0, 1.0/3.0);
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 =   v - i + dot(i, C.xxx);

        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);

        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;

        i = mod289(i);
        vec4 p = permute( permute( permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));

        float n_ = 1.0/7.0;
        vec3  ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);

        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);

        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);

        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1),
                                       dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1),
                                dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1),
                                    dot(p2,x2), dot(p3,x3)));
      }

      float fbm(vec3 p){
        float f = 0.0;
        float amp = 0.5;
        for(int i=0;i<5;i++){
          f += amp * snoise(p);
          p *= 2.1;
          amp *= 0.5;
        }
        return f;
      }

      void main() {
        vUv = uv;

        vec3 p = vec3(
          uv.x * uNoiseScale.x,
          uv.y * uNoiseScale.y,
          uTime * 0.05
        );

        float height = fbm(p);
        height = max(height, 0.0);

        vec3 displacedPosition = position + normal * (height * uDisplaceAmt);

        vec4 worldPos = modelMatrix * vec4(displacedPosition, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);

        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
        fragmentShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      uniform vec3 uBaseColor;
      uniform vec3 uMidColor;
      uniform vec3 uHighlight;
      uniform vec3 uLightDir;
      uniform vec2 uNoiseScale;
      uniform float uTime;

      vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
      vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise(vec3 v){
        const vec2  C = vec2(1.0/6.0, 1.0/3.0);
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 =   v - i + dot(i, C.xxx);

        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);

        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;

        i = mod289(i);
        vec4 p = permute( permute( permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));

        float n_ = 1.0/7.0;
        vec3  ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);

        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);

        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);

        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1),
                                       dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1),
                                dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1),
                                    dot(p2,x2), dot(p3,x3)));
      }

      float fbm(vec3 p){
        float f = 0.0;
        float amp = 0.5;
        for(int i=0;i<5;i++){
          f += amp * snoise(p);
          p *= 2.1;
          amp *= 0.5;
        }
        return f;
      }

      void main() {
        vec3 p = vec3(
          vUv.x * uNoiseScale.x,
          vUv.y * uNoiseScale.y,
          uTime * 0.05
        );

        float height = fbm(p);
        height = clamp(height * 0.7 + 0.3, 0.0, 1.0);

        float threads = snoise(vec3(vUv.x * 40.0, vUv.y * 3.0, 0.0));
        threads = smoothstep(0.4, 0.9, threads);

        vec3 N = normalize(vWorldNormal);
        vec3 L = normalize(uLightDir);
        vec3 V = normalize(cameraPosition - vWorldPos);

        float NdotL = max(dot(N, L), 0.0);
        float diffuse = 0.25 + 0.75 * NdotL;

        float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);

        vec3 col = uBaseColor;
        col = mix(col, uMidColor,  height);
        col = mix(col, uHighlight, threads * 0.9);

        col *= diffuse;
        col += rim * uHighlight * 0.6;

        vec2 center = vec2(0.5, 0.5);
        float dist = length(vUv - center);
        float vignette = smoothstep(0.9, 0.2, dist);
        col *= mix(0.6, 1.0, vignette);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
        side: THREE.DoubleSide
    });
}
