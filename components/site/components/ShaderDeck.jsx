'use client';
import { useEffect, useRef } from 'react';

const vertex = `#version 300 es
in vec2 position; out vec2 uv;
void main(){uv=(position+1.0)*0.5;gl_Position=vec4(position,0,1);}`;
const fragment = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 color;
uniform sampler2D cover; uniform vec2 pointer; uniform float time; uniform float strength;
void main(){
  vec2 p=vec2(uv.x,1.0-uv.y);
  float distanceToPointer=length(p-pointer);
  vec2 wave=sin(p.yx*13.0+time*.7)*.005*(1.0-smoothstep(0.0,.8,distanceToPointer));
  vec3 paper=texture(cover,clamp(p+wave,0.0,1.0)).rgb;
  float sheen=pow(max(0.0,1.0-distanceToPointer),5.0)*.28;
  float grain=fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453)*.025;
  color=vec4(paper+sheen+grain,strength);
}`;

// One context for the entire deck. The HTML buttons retain all selection and keyboard semantics.
export default function ShaderDeck({ deck, trips, reduced }) {
  const canvas = useRef(null);
  useEffect(() => {
    const surface = canvas.current;
    const parent = deck.current;
    if (!surface || !parent || reduced || navigator.connection?.saveData) return;
    let gl, program, buffer, frame, observer;
    let disposed = false, visible = false, pointer = [0.5, 0.5];
    const textures = [];
    const fail = () => { surface.style.display = 'none'; parent.dataset.shader = 'css'; cancelAnimationFrame(frame); };
    const draw = now => {
      if (disposed || !visible || document.hidden || !gl || gl.isContextLost()) return;
      try {
        const bounds = parent.getBoundingClientRect();
        const dpr = Math.min(devicePixelRatio, 1.5);
        const width = Math.round(bounds.width * dpr), height = Math.round(bounds.height * dpr);
        if (surface.width !== width || surface.height !== height) { surface.width = width; surface.height = height; }
        gl.disable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program); gl.enable(gl.SCISSOR_TEST);
        textures.forEach(({ image, button, texture }) => {
          if (!image) return;
          const rect = button.querySelector('.stamp-art').getBoundingClientRect();
          const x = Math.round((rect.left - bounds.left) * dpr), y = Math.round((bounds.bottom - rect.bottom) * dpr);
          gl.viewport(x, y, Math.round(rect.width * dpr), Math.round(rect.height * dpr));
          gl.scissor(Math.max(0, x), Math.max(0, y), Math.round(rect.width * dpr), Math.round(rect.height * dpr));
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.uniform2f(gl.getUniformLocation(program, 'pointer'), pointer[0], pointer[1]);
          gl.uniform1f(gl.getUniformLocation(program, 'time'), now / 1000);
          gl.uniform1f(gl.getUniformLocation(program, 'strength'), button.getAttribute('aria-pressed') === 'true' ? .22 : .12);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        });
        frame = requestAnimationFrame(draw);
      } catch { fail(); }
    };
    const start = () => {
      if (disposed || gl) return;
      try {
        gl = surface.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false });
        if (!gl) { fail(); return; }
        const compile = (type, source) => { const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error('shader'); return shader; };
        program = gl.createProgram();
        const shaders = [compile(gl.VERTEX_SHADER, vertex), compile(gl.FRAGMENT_SHADER, fragment)];
        shaders.forEach(shader => gl.attachShader(program, shader)); gl.linkProgram(program); shaders.forEach(shader => gl.deleteShader(shader));
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error('program');
        gl.useProgram(program); buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(program, 'position'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        trips.forEach(trip => {
          const button = [...parent.querySelectorAll('.stamp')].find(button => button.dataset.trip === trip.id);
          if (!button) return;
          const item = { button, image: null, texture: gl.createTexture() }; textures.push(item);
          const image = new Image();
          image.onload = () => {
            if (disposed || gl.isContextLost()) return;
            gl.bindTexture(gl.TEXTURE_2D, item.texture); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image); item.image = image;
          };
          image.src = trip.gallery[0]?.thumb ?? trip.hero;
        });
        surface.style.display = ''; parent.dataset.shader = 'webgl'; frame = requestAnimationFrame(draw);
      } catch { fail(); }
    };
    const visibility = () => { cancelAnimationFrame(frame); if (!document.hidden && visible) frame = requestAnimationFrame(draw); };
    const move = event => { const rect = event.target.closest('.stamp')?.getBoundingClientRect(); if (rect) pointer = [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height]; };
    const lost = event => { event.preventDefault(); fail(); };
    const restored = () => { gl = null; textures.length = 0; start(); };
    observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) { start(); visibility(); } else cancelAnimationFrame(frame); }, { rootMargin: '100px' });
    observer.observe(parent); document.addEventListener('visibilitychange', visibility); parent.addEventListener('pointermove', move, { passive: true }); surface.addEventListener('webglcontextlost', lost); surface.addEventListener('webglcontextrestored', restored);
    return () => { disposed = true; observer.disconnect(); cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', visibility); parent.removeEventListener('pointermove', move); surface.removeEventListener('webglcontextlost', lost); surface.removeEventListener('webglcontextrestored', restored); if (gl && !gl.isContextLost()) { textures.forEach(item => gl.deleteTexture(item.texture)); gl.deleteProgram(program); gl.deleteBuffer(buffer); } };
  }, [deck, trips, reduced]);
  return <canvas className="shader-deck" ref={canvas} aria-hidden="true" />;
}
