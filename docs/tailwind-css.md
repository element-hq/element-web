# Tailwind CSS 가이드

이 문서는 Clap Element Web 프로젝트에서 Tailwind CSS를 사용하는 방법에 대한 가이드입니다.

## 목차

- [개요](#개요)
- [기본 사용법](#기본-사용법)
- [중요 규칙](#중요-규칙)
- [레거시 CSS와의 공존](#레거시-css와의-공존)
- [테마 커스터마이징](#테마-커스터마이징)

## 개요

이 프로젝트는 Tailwind CSS v4를 사용하며, 기존 레거시 PostCSS 스타일과 공존합니다.

- **Tailwind CSS**: 신규 컴포넌트 및 기능 개발 시 사용
- **레거시 PostCSS**: 기존 컴포넌트는 수정하지 않고 유지

### 설정 파일

- **`tailwind.config.js`**: 콘텐츠 소스 지정 및 플러그인 확장
- **`res/css/tailwind.css`**: Tailwind CSS 진입점, Preflight 및 테마 설정

## 기본 사용법

### 유틸리티 클래스 사용

JSX에서 Tailwind 유틸리티 클래스를 직접 사용합니다:

```tsx
<div className="flex items-center gap-2 p-4">
    <span className="text-gray-700 font-semibold">Hello</span>
</div>
```

### 반응형 디자인

Tailwind의 반응형 브레이크포인트를 사용합니다:

```tsx
<div className="w-full md:w-1/2 lg:w-1/3">
    Responsive content
</div>
```

### 테마 값 사용

프로젝트에 정의된 테마 변수를 활용합니다:

```tsx
<button className="bg-primary text-primary-foreground">
    Primary Button
</button>
```

## 중요 규칙

### Important Modifier (!important)

**⚠️ 중요**: Tailwind CSS v4에서는 `!`를 클래스 이름 **끝**에 사용합니다.

**올바른 사용법:**
```tsx
// 클래스 이름 끝에 ! 사용
<a className="mx-4 text-[#2e2f32]!">
    Link
</a>

// 여러 클래스 중 하나만 important 적용
<div className="flex items-center text-blue-500!">
    Content
</div>
```

**잘못된 사용법:**
```tsx
// ❌ 클래스 이름 앞에 ! 사용 (Tailwind v3 스타일)
<a className="!text-[#2e2f32]">
    Link
</a>
```

**이유:**
- Tailwind CSS 포매터/린터가 권장하는 표준 형식입니다
- `suggestCanonicalClasses` 규칙에 따라 `text-[#2e2f32]!` 형식이 올바릅니다

### 레거시 CSS 오버라이드

레거시 PostCSS 스타일을 오버라이드해야 할 때는 important modifier를 사용합니다:

```tsx
// 레거시 CSS가 전역 <a> 태그에 파란색을 적용하는 경우
<a className="text-[#2e2f32]!">
    Custom colored link
</a>
```

## 레거시 CSS와의 공존

### Preflight 활성화

Tailwind Preflight는 활성화되어 있지만, 레거시 CSS가 나중에 로드되어 일부 스타일을 덮어쓸 수 있습니다.

**주요 레거시 CSS 파일:**
- `res/css/_common.pcss`: 전역 `<a>` 태그 스타일 (`color: $accent-alt`)
- `res/css/views/auth/_AuthBody.pcss`: AuthBody 내부 `<a>` 태그 스타일

**해결 방법:**
- Tailwind 클래스에 important modifier 사용: `text-[color]!`
- 또는 더 구체적인 선택자 사용

### 복잡한 스타일

복잡한 재사용 가능한 스타일의 경우:

1. **`@apply` 사용** (`.pcss` 파일에서):
```css
.my-custom-button {
    @apply flex items-center gap-2 px-4 py-2 bg-primary text-white rounded;
}
```

2. **컴포넌트 추출**: 재사용 가능한 스타일은 별도 컴포넌트로 분리

### 매직 넘버 문서화

z-index, 픽셀 조정 등 매직 넘버는 주석으로 문서화합니다:

```tsx
<div 
    className="absolute top-[-2px]" 
    // -2px: 시각적으로 수직 중앙 정렬
>
    Content
</div>
```

## 테마 커스터마이징

### 테마 변수 정의

`res/css/tailwind.css` 파일의 `@theme` 블록에서 커스텀 테마 변수를 정의합니다:

```css
@theme {
    /* Primary - Clap 브랜드 컬러 */
    --color-primary: #26231e;
    --color-primary-foreground: #ffffff;
    
    /* Secondary */
    --color-secondary: #f4f4f5;
    --color-secondary-foreground: #18181b;
    
    /* 기타 색상... */
}
```

### 사용 예시

```tsx
// 테마 변수 사용
<div className="bg-primary text-primary-foreground">
    Themed content
</div>

// Arbitrary 값 사용 (임시)
<div className="bg-[#custom-color]">
    Custom color
</div>
```

## 참고 자료

- [Tailwind CSS 공식 문서](https://tailwindcss.com/docs)
- [Tailwind CSS v4 문서](https://tailwindcss.com/docs/v4-beta)
- 프로젝트 내 `tailwind.config.js` 및 `res/css/tailwind.css` 파일 참조

