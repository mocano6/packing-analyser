import { ImageResponse } from 'next/og'

export const size = {
  width: 512,
  height: 512,
}
export const contentType = 'image/png'

export default function Icon512() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: '#22c55e',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          borderRadius: '64px',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '48px',
            left: '48px',
            right: '48px',
            bottom: '48px',
            border: '8px solid white',
            borderRadius: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Środkowa linia boiska */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '48px',
              right: '48px',
              height: '8px',
              backgroundColor: 'white',
              transform: 'translateY(-50%)',
            }}
          />
          {/* Środkowy krąg */}
          <div
            style={{
              width: '120px',
              height: '120px',
              border: '8px solid white',
              borderRadius: '50%',
              backgroundColor: 'transparent',
            }}
          />
          {/* Linie podań - strzałki */}
          <div
            style={{
              position: 'absolute',
              top: '120px',
              left: '96px',
              width: '120px',
              height: '12px',
              backgroundColor: '#fbbf24',
              borderRadius: '6px',
              transform: 'rotate(30deg)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '280px',
              right: '96px',
              width: '120px',
              height: '12px',
              backgroundColor: '#fbbf24',
              borderRadius: '6px',
              transform: 'rotate(-30deg)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '200px',
              left: '140px',
              width: '90px',
              height: '10px',
              backgroundColor: '#fbbf24',
              borderRadius: '5px',
              transform: 'rotate(60deg)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '200px',
              right: '140px',
              width: '90px',
              height: '10px',
              backgroundColor: '#fbbf24',
              borderRadius: '5px',
              transform: 'rotate(-60deg)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '160px',
              left: '180px',
              width: '80px',
              height: '8px',
              backgroundColor: '#fbbf24',
              borderRadius: '4px',
              transform: 'rotate(15deg)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '240px',
              right: '180px',
              width: '80px',
              height: '8px',
              backgroundColor: '#fbbf24',
              borderRadius: '4px',
              transform: 'rotate(-15deg)',
            }}
          />
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
} 