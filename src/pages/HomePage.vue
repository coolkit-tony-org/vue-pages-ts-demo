<script setup lang="ts">
const msg: string = 'Hello GitHub Pages (Vue+TS)'
</script>

<template>
    <main>
        <h1>{{ msg }}</h1>
        <p><router-link to="/about">Go About(Testing for github action )</router-link></p>
    </main>
</template>
