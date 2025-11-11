<script setup lang="ts">
const msg: string = 'Hello GitHub Pages (Vue+TS)'
</script>

<template>
    <main>
        <h1>{{ msg }}</h1>
        <p><router-link to="/about">Go About</router-link></p>
    </main>
</template>
