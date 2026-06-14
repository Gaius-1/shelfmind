import * as React from 'react'
import { useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { Frame, FramePanel } from '#/components/reui/frame.tsx'
import { Button } from '#/components/ui/button.tsx'
import { HugeiconsIcon } from '@hugeicons/react'
import { CloudUploadIcon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import gsap from 'gsap'
import { cn } from '#/lib/utils.ts'

const PROXIMITY_RADIUS = 200
const PUSH_FORCE = 4
const TILT_AMOUNT = 0.05
const NEIGHBOR_INFLUENCE = 0.15
const SPRING_STIFFNESS = 0.06
const BOUNCE_FRICTION = 0.75
const CURSOR_SMOOTHING = 0.75

const layout = {
  rotation: [-6, 4, -5, 8],
  x: [-70, -25, 25, 70],
  y: [5, -8, 12, -4],
}

export function UploadBatchCard() {
  const spotlightRef = useRef<HTMLDivElement>(null)
  const cardsContainerRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (!spotlightRef.current || !cardsContainerRef.current) return

    const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[]
    
    const cursor = { x: 0, y: 0, vx: 0, vy: 0 }
    let prevCursorX = 0
    let prevCursorY = 0

    const cardPhysics = cards.map((el, i) => {
      gsap.set(el, {
        x: layout.x[i],
        y: layout.y[i],
        rotation: layout.rotation[i],
        zIndex: i,
        xPercent: -50,
        yPercent: -50,
      })

      return {
        el,
        restX: layout.x[i],
        restY: layout.y[i],
        restR: layout.rotation[i],
        x: layout.x[i],
        y: layout.y[i],
        r: layout.rotation[i],
        vx: 0,
        vy: 0,
        vr: 0,
      }
    })

    const onMouseMove = (e: MouseEvent) => {
      const clientX = e.clientX
      const clientY = e.clientY

      cursor.vx = cursor.vx * CURSOR_SMOOTHING + (clientX - prevCursorX) * (1 - CURSOR_SMOOTHING)
      cursor.vy = cursor.vy * CURSOR_SMOOTHING + (clientY - prevCursorY) * (1 - CURSOR_SMOOTHING)
      prevCursorX = cursor.x = clientX
      prevCursorY = cursor.y = clientY
    }

    const onMouseLeave = () => {
      cursor.vx = cursor.vy = 0
    }

    spotlightRef.current.addEventListener('mousemove', onMouseMove)
    spotlightRef.current.addEventListener('mouseleave', onMouseLeave)

    function calculatePushForce(card: any) {
      const speed = Math.sqrt(cursor.vx ** 2 + cursor.vy ** 2)
      if (speed < 0.5) return { fx: 0, fy: 0 }

      const rect = cardsContainerRef.current!.getBoundingClientRect()
      const cx = rect.left + rect.width / 2 + card.restX
      const cy = rect.top + rect.height / 2 + card.restY
      
      const dist = Math.sqrt((cursor.x - cx) ** 2 + (cursor.y - cy) ** 2)

      if (dist > PROXIMITY_RADIUS) return { fx: 0, fy: 0 }

      const weight = Math.pow(1 - dist / PROXIMITY_RADIUS, 3)

      return {
        fx: cursor.vx * PUSH_FORCE * weight,
        fy: cursor.vy * PUSH_FORCE * weight,
      }
    }

    function applyNeighborInfluence(forces: any[], index: number) {
      let fx = forces[index].fx
      let fy = forces[index].fy

      forces.forEach((f, j) => {
        if (j === index) return
        const falloff = Math.pow(NEIGHBOR_INFLUENCE, Math.abs(j - index))
        fx += f.fx * falloff
        fy += f.fy * falloff * 0.6
      })

      return { fx, fy }
    }

    const ticker = gsap.ticker.add(() => {
      const forces = cardPhysics.map(calculatePushForce)

      cardPhysics.forEach((card, i) => {
        const { fx, fy } = applyNeighborInfluence(forces, i)

        card.vx = (card.vx + (card.restX + fx - card.x) * SPRING_STIFFNESS) * BOUNCE_FRICTION
        card.vy = (card.vy + (card.restY + fy - card.y) * SPRING_STIFFNESS) * BOUNCE_FRICTION
        card.vr = (card.vr + (card.restR + fx * TILT_AMOUNT - card.r) * SPRING_STIFFNESS) * BOUNCE_FRICTION

        card.x += card.vx
        card.y += card.vy
        card.r += card.vr

        gsap.set(card.el, { x: card.x, y: card.y, rotation: card.r })
      })
    })

    return () => {
      spotlightRef.current?.removeEventListener('mousemove', onMouseMove)
      spotlightRef.current?.removeEventListener('mouseleave', onMouseLeave)
      gsap.ticker.remove(ticker)
    }
  }, [])

  return (
    <Frame spacing="xs" className="w-full h-full relative group">
      <FramePanel 
        ref={spotlightRef}
        className="w-full h-full p-6 relative overflow-hidden flex flex-col items-center justify-between text-center bg-card"
      >
        
        {/* Top Content */}
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="size-12 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/90 backdrop-blur-md flex items-center justify-center shadow-inner border border-indigo-200 dark:border-indigo-800">
            <HugeiconsIcon icon={CloudUploadIcon} strokeWidth={2} className="size-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground font-heading">
            Ingest New Batch
          </h2>
        </div>

        {/* Middle Content: Interactive Magnetic Cards Background */}
        <div 
          ref={cardsContainerRef}
          className="relative pointer-events-none flex-1 w-full min-h-[160px] opacity-40 group-hover:opacity-100 transition-opacity duration-700"
        >
          {/* Inner positioning container */}
          <div className="absolute top-1/2 left-1/2">
            {['/media/cards/cereal.png', '/media/cards/shampoo.png', '/media/cards/coffee.png', '/media/cards/supplement.png'].map((src, i) => (
              <div
                key={i}
                ref={(el) => { cardRefs.current[i] = el }}
                className="absolute w-[80px] h-[80px] sm:w-[100px] sm:h-[100px] rounded-xl overflow-hidden shadow-2xl border border-white/20 bg-muted"
              >
                <img src={src} alt="Product packaging example" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Content */}
        <div className="relative z-10 flex flex-col items-center pointer-events-none gap-4">
          <p className="text-sm font-medium text-muted-foreground bg-card/50 backdrop-blur-md rounded-lg py-1 px-2 max-w-[280px]">
            Upload up to 20 product images to run through the hybrid AI extraction pipeline.
          </p>

          <Button asChild className="pointer-events-auto">
            <Link to="/dashboard/uploads">
              Start Extraction
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2.5} />
            </Link>
          </Button>
        </div>
        
      </FramePanel>
    </Frame>
  )
}
