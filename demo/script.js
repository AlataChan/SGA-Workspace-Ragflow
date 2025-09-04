document.addEventListener('DOMContentLoaded', () => {
    const agents = [
        { name: '李昂 (Leon Li)', title: '首席运营官 (COO)', description: '基于GPT-4O，公司001号大模型员工。负责公司产品战略、定价战略、运营战略及投融资事宜。', image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=600&fit=crop' },
        { name: '李薇 (Vivian Li)', title: '首席人力官 (CHO)', description: '基于Gemini 1.5 Pro，负责公司人力资源战略，以及Ai Consultant团队的构建与赋能。', image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=600&fit=crop' },
        { name: '张睿 (Alex Zhang)', title: '法务及风控主管', description: '基于Gemini 1.5 Pro，负责公司风控、合同制定与审核，确保公司在合规的轨道上高速发展。', image: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?w=400&h=600&fit=crop' },
        { name: '赵思睿 (Sophia)', title: 'B端顾问 (ABC)', description: '基于GPT-4O，负责设计、规划企业级大模型应用方案，为客户提供专业的智能化转型咨询。', image: 'https://images.unsplash.com/photo-1554151228-14d9def656e4?w=400&h=600&fit=crop' },
        { name: '蔡婉清 (Wendy)', title: '财务经理', description: '基于GPT-4O，从ERP系统中获取财务数据进行分析，并对财务数据进行调整和分析。', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=600&fit=crop' },
    ];

    const carousel = document.querySelector('.agent-carousel');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    // Removed direct references to agent-details panel elements

    const cardCount = agents.length;
    const angle = 360 / cardCount;
    const radius = 350; // Distance of cards from the center of the carousel
    let currentRotation = 0;
    let selectedIndex = 0;

    // Dynamically create and position cards in a circle
    function setupCarousel() {
        agents.forEach((agent, i) => {
            const card = document.createElement('div');
            card.classList.add('agent-card');
            card.dataset.index = i; // Store index for later reference

            const cardRotation = i * angle;
            // The magic happens here: position each card in 3D space
            card.style.transform = `rotateY(${cardRotation}deg) translateZ(${radius}px)`;
            card.style.setProperty('--radius', `${radius}px`); // Pass radius as CSS variable for active state

            card.innerHTML = `
                <img src="${agent.image}" alt="${agent.name}">
                <div class="agent-info-bottom">
                    <h4>${agent.name}</h4>
                    <p>${agent.description}</p>
                </div>
            `;
            carousel.appendChild(card);
        });
        updateActiveCard(0); // Set initial active card
    }

    function rotateCarousel() {
        carousel.style.transform = `rotateY(${currentRotation}deg)`;
        updateActiveCard(selectedIndex); // Update active card after rotation
    }
    
    function updateActiveCard(index) {
        const cards = document.querySelectorAll('.agent-card');
        cards.forEach((card, i) => {
            if (i === index) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });
    }

    nextBtn.addEventListener('click', () => {
        currentRotation -= angle;
        selectedIndex = (selectedIndex + 1) % cardCount;
        rotateCarousel();
    });

    prevBtn.addEventListener('click', () => {
        currentRotation += angle;
        selectedIndex = (selectedIndex - 1 + cardCount) % cardCount;
        rotateCarousel();
    });

    // Initialize
    setupCarousel();
});