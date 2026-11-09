<template><div class="trend-chart"><svg viewBox="0 0 600 170" role="img" :aria-label="label"><g v-for="i in 4" :key="i"><line x1="42" :y1="18+(i-1)*36" x2="588" :y2="18+(i-1)*36" stroke="currentColor" opacity=".12"/><text x="0" :y="22+(i-1)*36" fill="currentColor" font-size="11">{{fmt(max-(i-1)*(max-min)/3)}}</text></g><path v-if="points.length" :d="fill" fill="url(#chart-fill)"/><path v-if="points.length" :d="path" fill="none" stroke="#43d5dc" stroke-width="2"/><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#38d5e0" stop-opacity=".25"/><stop offset="100%" stop-color="#38d5e0" stop-opacity="0"/></linearGradient></defs><text x="42" y="158" fill="currentColor" font-size="11">{{labels[0]||''}}</text><text x="588" y="158" text-anchor="end" fill="currentColor" font-size="11">{{labels.at(-1)||''}}</text><text v-if="!points.length" x="300" y="80" text-anchor="middle" fill="currentColor">暂无数据</text></svg></div></template>
<script setup>
import {computed} from 'vue';
const props=defineProps({values:{type:Array,default:()=>[]},labels:{type:Array,default:()=>[]},label:{type:String,default:'数值过程曲线'}});
const nums=computed(()=>props.values.map(Number).filter(Number.isFinite));
const min=computed(()=>nums.value.length?Math.min(...nums.value):0);
const max=computed(()=>nums.value.length?Math.max(...nums.value)+(Math.max(...nums.value)===min.value?1:0):1);
const points=computed(()=>nums.value.map((n,i)=>[42+i/Math.max(1,nums.value.length-1)*546,126-(n-min.value)/(max.value-min.value)*108]));
const path=computed(()=>points.value.map((p,i)=>(i?'L':'M')+p.join(',')).join(' '));
const fill=computed(()=>path.value+' L588,126 L42,126 Z');
const fmt=n=>Number(n).toFixed(Math.abs(n)<10?2:1);
</script>
