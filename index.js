const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const pry = require('pryjs');
const foods = require('./lib/routes/api/v1/foods')

const environment = process.env.NODE_ENV || 'development';
const configuration = require('./knexfile')[environment];
const database = require('knex')(configuration);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('port', process.env.PORT || 3030);
app.locals.title = 'Quantified Self';
app.use(function (request, response, next) {
  response.header("Access-Control-Allow-Origin",
    "*");
  response.header("Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept");
  response.header("Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, OPTIONS");
  next();
});

// app.get('/api/v1/foods', (request, response) => {
//   database('foods').orderBy('id', 'DESC').select()
//     .then((foods) => {
//       response.status(200).json(foods);
//     })
//     .catch((error) => {
//       response.status(400).json({ error });
//     });
// });
app.use('/api/v1/foods', foods);

app.get('/api/v1/foods/:id', (request, response) => {
  database('foods').where('id', request.params.id).select()
    .then(foods => {
      if (foods.length) {
        response.status(200).json(foods);
      } else {
        response.status(404).json({
          error: `Could not find food with id ${request.params.id}`
        });
      }
    })
    .catch(error => {
      response.status(500).json({ error });
    });
});

app.post('/api/v1/foods', (request, response) => {
  const food = request.body;
  for (let requiredParameter of ['name', 'calories']) {
    if (!food[requiredParameter]) {
      return response
        .status(422)
        .send({ error: `Expected format: { name: <String>, calories: <Integer> }. You're missing a "${requiredParameter}" property.` });
    }
  }
  database('foods').insert(food, '*')
    .then(food => {
      response.status(201).json({ food });
    })
    .catch(error => {
      response.status(400).json({ error });
    });
});

app.patch('/api/v1/foods/:id', (request, response) =>{
  const food = request.body;
  for (let requiredParameter of ['name', 'calories']) {
    if (!food[requiredParameter]) {
      return response
        .status(400)
        .send({ error: `Expected format: { name: <String>, calories: <Integer> }. You're missing a "${requiredParameter}" property.` });
    }
  }
    database('foods').where('id', request.params.id).select().update({"name": food.name, "calories": food.calories}, '*')
    .then(food => {
      response.status(200).json({ food });
    })
    .catch(error => {
      response.status(400).json({ error });
    });
});

app.delete('/api/v1/foods/:id', (request, response) => {
  database('foods').where('id', request.params.id).del()
    .then(foods => {
      if (foods == 1) {
        response.status(204).json({ success: true });
      } else {
        response.status(404).json({ error });
      }
    })
    .catch(error => {
      response.status(404).json({ error });
    });
})

app.get('/api/v1/days', (request, response) => {
  database('days').select()
  .then((days) => {
    response.status(200).json(days);
  })
  .catch((error) => {
    response.status(400).json({ error });
  });
});

app.post('/api/v1/days', (request, response) => {
  const day = request.body;
  for (let requiredParameter of ['goal']) {
    if (!day[requiredParameter]) {
      return response
        .status(422)
        .send({ error: `Expected format: { goal: <Integer> }. You're missing a "${requiredParameter}" property.` });
    }
  }
  database('days').insert(day, '*')
    .then(day => {

      response.status(201).json({ day });
    })
    .catch(error => {
      response.status(400).json({ error });
    });
});

app.post('/api/v1/days/:day_id/meals', (request, response) => {
  let meal = {
    'meal_type': request.body.meal_type,
    'day_id': parseInt(request.params.day_id)
  }

  for (let requiredParameter of ['meal_type']) {
    if (!meal[requiredParameter]) {
      return response
        .status(422)
        .send({ error: `Expected format: { meal_type: <Meal> }. You're missing a "${requiredParameter}" property.` });
    }
  }
  database('meals').insert(meal, '*')
    .then(meal => {
      response.status(201).json({ meal });
    })
    .catch(error => {
      response.status(400).json({ error });
    });
});


app.get('/api/v1/today', (request, response) => {

  database('days').select()
  .then((days) => {
    response.status(200).json(days[days.length - 1]);
  })
  .catch((error) => {
    response.status(400).json({ error });
  });
});

app.get('/api/v1/days/:id/meals', (request, response) => {
  database('meals').where('meals.day_id', request.params.id).leftJoin('meal_foods', 'meals.id', '=', 'meal_foods.meal_id', 'foods.').leftJoin('foods', 'meal_foods.food_id', '=', 'foods.id').select("meals.id AS id", "meal_type AS name", "name AS food", "calories AS calories", "foods.id AS food_id").groupBy('meals.id', "foods.name", "foods.calories", "foods.id").orderBy('meals.id')
  .then((meals) => {
    let newMeals = meals.reduce((acc, meal, _, src) => {
      let found = acc.find(m => m.id === meal.id);
      if (found) return acc;

      let obj;
      let founds = src.filter(m => m.id === meal.id);

      if (meal.food) {
        let newFood = founds.map(e => ({ id: e.food_id, name: e.food, calories: e.calories }))
        obj = { ...meal, foods: newFood }
      } else {
        obj = { ...meal, foods: [] }
      };

      return [...acc, obj]
    }, []).map(e => ({ id: e.id, name: e.name, foods: e.foods }));

    response.status(200).json(newMeals);
  })
  .catch((error) => {
    response.status(400).json({ error });
  });
});


app.get('/api/v1/meals', (request, response) => {
  database('meals').leftJoin('meal_foods', 'meals.id', '=', 'meal_foods.meal_id', 'foods.').leftJoin('foods', 'meal_foods.food_id', '=', 'foods.id').select("meals.id AS id", "meal_type AS name", "name AS food", "calories AS calories", "foods.id AS food_id", "meals.created_at AS meal_date").groupBy('meals.id', "foods.name", "foods.calories", "foods.id").orderBy('meals.id')
  .then((meals) => {
    let newMeals = meals.reduce((acc, meal, _, src) => {
      let found = acc.find(m => m.id === meal.id);
      if (found) return acc;

      let obj;
      let founds = src.filter(m => m.id === meal.id);

      if (meal.food) {
        let newFood = founds.map(e => ({ id: e.food_id, name: e.food, calories: e.calories }))
        obj = { ...meal, foods: newFood }
      } else {
        obj = { ...meal, foods: [] }
      };

      return [...acc, obj]
    }, []).map(e => ({ id: e.id, name: e.name, date: e.meal_date, foods: e.foods }));

    response.status(200).json(newMeals);
  })
  .catch((error) => {
    response.status(400).json({ error });
  });
});

app.get('/api/v1/meals/:meal_id/foods', (request, response) => {
  database('meal_foods').where('meal_id', request.params.meal_id)
  .join('foods', 'meal_foods.food_id', '=', 'foods.id')
  .join('meals', 'meal_foods.meal_id', '=', 'meals.id')
  .select('foods.id AS id', 'foods.name AS name', 'calories', 'meals.meal_type AS meal_name')
  .then(foods => {
    let foods_for_meal = [];

    let meal_name = foods[0].meal_name;
    foods.forEach( (f) => {
      delete f.meal_name;
      foods_for_meal.push(f)
    });

    response.status(200).json({
      'id': request.params.meal_id,
      'meal': meal_name,
      'foods': foods_for_meal
    })
  })
  .catch((error) => {
    response.status(404).json({ error });
  });
});

app.post('/api/v1/meals/:meal_id/foods/:food_id', (request, response) => {
  database('meal_foods').insert(
    {
    'meal_id': request.params.meal_id,
    'food_id': request.params.food_id
    })
    .then(() => {
      database('meal_foods')
      .where('food_id', request.params.food_id)
      .where('meal_id', request.params.meal_id)
      .join('meals', 'meal_foods.meal_id', '=', 'meals.id')
      .join('foods', 'meal_foods.food_id', '=', 'foods.id')
      .select('meals.meal_type AS meal_name', 'foods.name AS food_name')
      .distinct()
      .first()

      .then((result) => {
        let meal_name = result.meal_name;
        let food_name = result.food_name;
        response.status(201).json({ 'message' : `Successfully added ${food_name} to ${meal_name}.` });
      })
    })
    .catch((error) => {
      response.status(404).json({ error })
    });
});


app.delete('/api/v1/meals/:meal_id/foods/:food_id', (request, response) => {
      database('meal_foods')
      .where('food_id', request.params.food_id)
      .where('meal_id', request.params.meal_id)
      .join('meals', 'meal_foods.meal_id', '=', 'meals.id')
      .join('foods', 'meal_foods.food_id', '=', 'foods.id')
      .select('meals.meal_type AS meal_name', 'foods.name AS food_name')
      .distinct()
      .first()
    .then((result) => {
      let data = { 'mealName': `${result.meal_name}`, 'foodName': `${result.food_name}` }
      database('meal_foods')
        .where('food_id', request.params.food_id)
        .andWhere('meal_id', request.params.meal_id).del()
      .then(() => {
        response.status(200).json({ 'message' : `Successfully removed ${data.foodName} from ${data.mealName}.` });
      })
    })
    .catch((error) => {
      response.status(404).json({ error })
    });
});

app.listen(app.get('port'), () => {
  console.log(`${app.locals.title} is running on ${app.get('port')}.`);
});

module.exports = app;
