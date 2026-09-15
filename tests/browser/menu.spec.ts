import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

const key = 'neon-strike:preferences:v1';

test('all menu routes, return, focus and browser history work without replacing the canvas', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('Renderização ativa', { exact: true })).toBeVisible();
  const canvas = await page.locator('canvas').elementHandle();
  for (const name of ['JOGAR', 'MULTIPLAYER', 'TREINAMENTO', 'CONFIGURAÇÕES', 'CRÉDITOS', 'SAIR']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('heading', { name, exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Voltar ao menu', exact: true }).click();
    await expect(page.getByRole('button', { name, exact: true })).toBeFocused();
    expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true);
  }
  await page.getByRole('button', { name: 'CRÉDITOS', exact: true }).click();
  await page.goBack();
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'CRÉDITOS', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('offline setup saves player name, map, bot count and difficulty across reloads', async ({ page }) => {
  await page.goto('/#play');
  await page.getByLabel('Nome do jogador').fill('Chris Silva');
  await page.getByLabel('Número de bots').selectOption('7');
  await page.getByLabel('Dificuldade').selectOption('hard');
  await expect(page.getByRole('button', { name: 'INICIAR PARTIDA' })).toBeEnabled();
  await page.reload();
  await expect(page.getByLabel('Nome do jogador')).toHaveValue('Chris Silva');
  await expect(page.getByLabel('Número de bots')).toHaveValue('7');
  await expect(page.getByLabel('Dificuldade')).toHaveValue('hard');
  await expect(page.getByLabel('Escolher mapa')).toHaveValue('neon-facility');
  await page.getByLabel('Número de bots').selectOption('1');
  await page.getByLabel('Dificuldade').selectOption('easy');
  await page.getByLabel('Nome do jogador').fill('   ');
  await page.getByLabel('Nome do jogador').press('Tab');
  await expect(page.getByLabel('Nome do jogador')).toHaveValue('Player');
});

test('video controls change the render buffer and save bounded preferences', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/#settings');
  await expect(page.getByText('Renderização ativa', { exact: true })).toBeVisible();
  const canvas = await page.locator('canvas').elementHandle();
  await page.getByLabel('Resolução de renderização').selectOption('1280x720');
  await expect.poll(() => page.locator('canvas').evaluate((element) => [element.width, element.height])).toEqual([1280, 720]);
  await page.getByLabel('Qualidade', { exact: true }).selectOption('low');
  await expect.poll(() => page.locator('canvas').evaluate((element) => [element.width, element.height])).toEqual([1200, 675]);
  await page.getByLabel('FPS máximo').selectOption('30');
  await page.getByRole('slider', { name: 'FOV da partida' }).press('End');
  await page.getByRole('switch', { name: 'Sombras' }).uncheck();
  expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true);
  await page.reload();
  await expect(page.getByLabel('Qualidade', { exact: true })).toHaveValue('low');
  await expect(page.getByLabel('FPS máximo')).toHaveValue('30');
  await expect(page.getByRole('slider', { name: 'FOV da partida' })).toHaveValue('110');
  await expect(page.getByRole('switch', { name: 'Sombras' })).not.toBeChecked();
});

test('audio, sensitivity and head bob persist and settings tabs support keyboard navigation', async ({ page }) => {
  await page.goto('/#settings');
  await page.getByRole('tab', { name: 'VÍDEO', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'ÁUDIO', exact: true })).toBeFocused();
  for (const name of ['Volume geral', 'Efeitos', 'Música', 'Interface', 'Passos']) {
    await page.getByRole('slider', { name, exact: true }).press('End');
  }
  await page.getByRole('tab', { name: 'CONTROLES', exact: true }).click();
  await page.getByRole('slider', { name: 'Sensibilidade do mouse' }).press('End');
  await expect(page.locator('kbd', { hasText: 'W' })).toBeVisible();
  await page.getByRole('tab', { name: 'JOGABILIDADE', exact: true }).click();
  await page.getByRole('switch', { name: 'Head bob' }).uncheck();
  await page.reload();
  await page.getByRole('tab', { name: 'ÁUDIO', exact: true }).click();
  for (const name of ['Volume geral', 'Efeitos', 'Música', 'Interface', 'Passos']) {
    await expect(page.getByRole('slider', { name, exact: true })).toHaveValue('100');
  }
  await page.getByRole('tab', { name: 'CONTROLES', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Sensibilidade do mouse' })).toHaveValue('3');
  await page.getByRole('tab', { name: 'JOGABILIDADE', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Head bob' })).not.toBeChecked();
});

test('restore requires confirmation, Escape cancels only the dialog and player setup is retained', async ({ page }) => {
  await page.goto('/#play');
  await page.getByLabel('Nome do jogador').fill('Chris');
  await page.getByLabel('Número de bots').selectOption('7');
  await page.getByRole('button', { name: 'Voltar ao menu', exact: true }).click();
  await page.getByRole('button', { name: 'CONFIGURAÇÕES', exact: true }).click();
  await page.getByLabel('Qualidade', { exact: true }).selectOption('low');
  await page.getByRole('button', { name: 'Restaurar padrões' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Qualidade', { exact: true })).toHaveValue('low');
  await page.getByRole('button', { name: 'Restaurar padrões' }).click();
  await page.getByRole('button', { name: 'Restaurar', exact: true }).click();
  await expect(page.getByLabel('Qualidade', { exact: true })).toHaveValue('medium');
  await page.getByRole('button', { name: 'Voltar ao menu', exact: true }).click();
  await page.getByRole('button', { name: 'JOGAR', exact: true }).click();
  await expect(page.getByLabel('Nome do jogador')).toHaveValue('Chris');
  await expect(page.getByLabel('Número de bots')).toHaveValue('7');
});

for (const value of ['not-json', JSON.stringify({ version: 99 }), JSON.stringify({ version: 1, preferences: {
  video: { fov: 999, quality: 'ultra', maxFps: 'infinity' }, controls: { sensitivity: -5 },
  audio: { master: 200 }, match: { bots: 100 }, gameplay: { headBob: 'no' },
} })]) {
  test(`invalid storage is recovered: ${value.slice(0, 35)}`, async ({ page }) => {
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key, value });
    await page.goto('/#settings');
    await expect(page.getByLabel('Qualidade', { exact: true })).toHaveValue('medium');
    await expect(page.getByLabel('FPS máximo')).toHaveValue('60');
    const fov = Number(await page.getByRole('slider', { name: 'FOV da partida' }).inputValue());
    expect(fov).toBeGreaterThanOrEqual(60);
    expect(fov).toBeLessThanOrEqual(110);
    await expect(page.getByText('Renderização ativa', { exact: true })).toBeVisible();
  });
}

test('blocked localStorage retains working controls and reports session-only changes', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', {
    get() { throw new DOMException('Storage disabled', 'SecurityError'); },
  }));
  await page.goto('/#settings');
  await expect(page.getByText('Alterações só nesta sessão')).toBeVisible();
  await page.getByLabel('Qualidade', { exact: true }).selectOption('low');
  await expect(page.getByLabel('Qualidade', { exact: true })).toHaveValue('low');
  await page.getByRole('button', { name: 'Voltar ao menu', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();
});

test('fullscreen can be entered and exited without changing the settings route', async ({ page }) => {
  await page.goto('/#settings');
  await page.getByRole('button', { name: 'Ativar tela cheia' }).click();
  await expect(page.getByRole('button', { name: 'Sair da tela cheia' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await page.getByRole('button', { name: 'Sair da tela cheia' }).click();
  await expect(page.getByRole('button', { name: 'Ativar tela cheia' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page).toHaveURL(/#settings$/);
});

test('fullscreen rejection gives feedback and tutorial replay can be scheduled', async ({ page }) => {
  await page.addInitScript((key) => {
    Element.prototype.requestFullscreen = () => Promise.reject(new Error('Denied'));
    localStorage.setItem(key, JSON.stringify({ version: 1, preferences: { gameplay: { tutorialCompleted: true } } }));
  }, key);
  await page.goto('/#settings');
  await page.getByRole('button', { name: 'Ativar tela cheia' }).click();
  await expect(page.getByRole('alert')).toHaveText('Tela cheia indisponível neste navegador.');
  await page.getByRole('tab', { name: 'JOGABILIDADE', exact: true }).click();
  await page.getByRole('button', { name: 'MOSTRAR TUTORIAL NOVAMENTE' }).click();
  await expect(page.getByText('Tutorial agendado para a primeira partida.')).toBeVisible();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).preferences.gameplay.tutorialCompleted, key)).toBe(false);
});

test('LAN connection and local training are enabled while room creation remains unavailable', async ({ page }) => {
  await page.goto('/#multiplayer');
  await expect(page.getByRole('button', { name: 'CRIAR PARTIDA' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'CONECTAR' })).toBeEnabled();
  await page.getByRole('button', { name: 'Voltar ao menu', exact: true }).click();
  await page.getByRole('button', { name: 'TREINAMENTO', exact: true }).click();
  await expect(page.getByRole('button', { name: 'INICIAR TREINAMENTO' })).toBeEnabled();
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
  test(`menu screens fit at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByText('Renderização ativa', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('menu.png'), fullPage: true });
    for (const name of ['JOGAR', 'CONFIGURAÇÕES', 'CRÉDITOS', 'MULTIPLAYER', 'TREINAMENTO', 'SAIR']) {
      await page.getByRole('button', { name, exact: true }).click();
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const overflow = await page.locator('button, select, input').evaluateAll((elements) => elements
        .filter((element) => element.getBoundingClientRect().width > 0 && element.scrollWidth > element.clientWidth + 2)
        .map((element) => element.textContent));
      expect(overflow).toEqual([]);
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const screen = PNG.sync.read(await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true }));
      const title = (await page.locator('h1').boundingBox())!;
      let titlePixels = 0;
      for (let y = Math.floor(title.y); y < title.y + title.height; y++) {
        for (let x = Math.floor(title.x); x < title.x + title.width; x++) {
          const index = (y * screen.width + x) * 4;
          if (screen.data[index]! > 170 && screen.data[index + 1]! > 170 && screen.data[index + 2]! > 170) titlePixels++;
        }
      }
      expect(titlePixels).toBeGreaterThan(100);
      if (name === 'CONFIGURAÇÕES') {
        for (const tab of ['ÁUDIO', 'CONTROLES', 'JOGABILIDADE']) {
          await page.getByRole('tab', { name: tab, exact: true }).click();
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          await page.screenshot({ path: testInfo.outputPath(`${tab}.png`), fullPage: true });
        }
      }
      await page.getByRole('button', { name: 'Voltar ao menu', exact: true }).click();
    }
  });
}
